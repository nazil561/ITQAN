import asyncio
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import and_, func, or_, select

from app.api.deps import SessionDep
from app.api.v1.adapters import finding_to_frontend
from app.models.analysis import Finding
from app.models.compound import Compound
from app.models.plant import Plant
from app.models.target import Target

router = APIRouter(tags=["findings"])


@router.get("/analyses/{run_id}/findings")
async def list_findings_for_run(run_id: uuid.UUID, session: SessionDep):
    rows = (await session.execute(
        select(Finding).where(Finding.run_id == run_id)
        # id breaks score ties so rank is stable and matches GET /findings/{id}.
        .order_by(Finding.score.desc(), Finding.id)
    )).scalars().all()
    return [await finding_to_frontend(session, f, rank=i + 1) for i, f in enumerate(rows)]


@router.get("/findings/{finding_id}")
async def get_finding(finding_id: uuid.UUID, session: SessionDep):
    f = await session.get(Finding, finding_id)
    if f is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    ahead = (await session.execute(
        select(func.count(Finding.id)).where(
            Finding.run_id == f.run_id,
            or_(Finding.score > f.score, and_(Finding.score == f.score, Finding.id < f.id)),
        )
    )).scalar() or 0
    return await finding_to_frontend(session, f, rank=ahead + 1)


def _shape_for_frontend(raw: dict) -> dict:
    """Convert internal llm_interpretation JSON into the frontend's interpretation schema."""
    summary_parts = []
    if raw.get("plain_summary"):
        summary_parts.append(raw["plain_summary"].strip())
    if raw.get("mechanistic_hypothesis"):
        summary_parts.append(raw["mechanistic_hypothesis"].strip())
    return {
        "summary": "\n\n".join(summary_parts),
        "model": raw.get("model", "unknown"),
        "generated_at": raw.get("generated_at", ""),
        "caveats": raw.get("limitations", []) or [],
    }


@router.post("/findings/{finding_id}/interpretation")
async def interpret_finding_endpoint(finding_id: uuid.UUID, session: SessionDep):
    f = await session.get(Finding, finding_id)
    if f is None:
        raise HTTPException(status_code=404, detail="Finding not found")

    # Cache hit — return existing interpretation
    if f.llm_interpretation and isinstance(f.llm_interpretation, dict) and "error" not in f.llm_interpretation:
        return _shape_for_frontend(f.llm_interpretation)

    # Build evidence payload from DB rows
    ca = await session.get(Compound, f.compound_a_id) if f.compound_a_id else None
    cb = await session.get(Compound, f.compound_b_id) if f.compound_b_id else None
    tg = await session.get(Target, f.target_id) if f.target_id else None

    prov = f.provenance or {}
    pa = None
    pb = None
    try:
        if prov.get("plant_a_id"):
            pa = await session.get(Plant, uuid.UUID(prov["plant_a_id"]))
        if prov.get("plant_b_id"):
            pb = await session.get(Plant, uuid.UUID(prov["plant_b_id"]))
    except (ValueError, TypeError):
        pass

    payload = {
        "formulation_hint": "cross-plant shared-target finding",
        "plant_a": {"name": pa.canonical_name if pa else None, "family": pa.family if pa else None},
        "plant_b": {"name": pb.canonical_name if pb else None, "family": pb.family if pb else None},
        "compound_a": {
            "name": ca.name if ca else None,
            "inchikey": ca.inchikey if ca else None,
            "pubchem_cid": ca.pubchem_cid if ca else None,
        },
        "compound_b": {
            "name": cb.name if cb else None,
            "inchikey": cb.inchikey if cb else None,
            "pubchem_cid": cb.pubchem_cid if cb else None,
        },
        "target": {
            "name": tg.name if tg else prov.get("target_name"),
            "gene_symbol": tg.gene_symbol if tg else None,
            "uniprot_id": tg.uniprot_id if tg else None,
        },
        "measured_activity_nM": {
            "compound_a": prov.get("activity_a_nM"),
            "compound_b": prov.get("activity_b_nM"),
        },
        "shared_target_count": prov.get("shared_target_count", 1),
        "evidence_tier": getattr(f.evidence_tier, "value", str(f.evidence_tier)),
        "score": f.score,
    }

    try:
        from app.llm.finding_interpreter import interpret_finding
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"LLM module unavailable: {exc}")

    try:
        # Sync Groq client: run off the event loop so other requests are not blocked.
        interp = await asyncio.to_thread(interpret_finding, payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {type(exc).__name__}: {str(exc)[:200]}")

    if "error" in interp:
        raise HTTPException(status_code=502, detail=f"LLM error: {interp.get('error')}")

    f.llm_interpretation = interp
    session.add(f)
    await session.commit()

    return _shape_for_frontend(interp)

@router.get("/findings/{finding_id}/export", response_class=PlainTextResponse)
async def export_lab_protocol(finding_id: uuid.UUID, session: SessionDep):
    f = await session.get(Finding, finding_id)
    if not f or not f.llm_interpretation:
        raise HTTPException(status_code=404, detail="Interpretation not found. Please generate it first.")

    interp = f.llm_interpretation
    ca = await session.get(Compound, f.compound_a_id)
    cb = await session.get(Compound, f.compound_b_id)
    tg = await session.get(Target, f.target_id)

    protocol = f"""# ITQAN Lab Protocol: Cross-Plant Molecular Finding

## 1. Finding Details
- **Compound A:** {ca.name if ca else 'Unknown'} (InChIKey: {ca.inchikey if ca else 'N/A'})
- **Compound B:** {cb.name if cb else 'Unknown'} (InChIKey: {cb.inchikey if cb else 'N/A'})
- **Shared Target:** {tg.name if tg else 'Unknown'} (Gene: {tg.gene_symbol if tg else 'N/A'})
- **Evidence Tier:** {f.evidence_tier} (Score: {f.score})

## 2. AI Mechanistic Hypothesis
{interp.get('mechanistic_hypothesis', 'N/A')}

## 3. Proposed Wet-Lab Experiments
"""
    for idx, experiment in enumerate(interp.get('testable_predictions', []), 1):
        protocol += f"{idx}. {experiment}\n"

    protocol += f"""
## 4. Known Limitations
"""
    for limitation in interp.get('limitations', []):
        protocol += f"- {limitation}\n"

    protocol += "\n---\nGenerated by ITQAN AI. This is a computational hypothesis, not a clinical directive.\n"

    return PlainTextResponse(
        content=protocol,
        headers={"Content-Disposition": f'attachment; filename="ITQAN_Protocol_{finding_id}.md"'}
    )

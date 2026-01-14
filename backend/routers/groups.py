from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Group, ExtractedNumber, number_groups
from schemas import GroupCreate, GroupUpdate, GroupResponse, GroupDetailResponse, AddNumbersToGroup

router = APIRouter()


@router.post("", response_model=GroupResponse)
async def create_group(
    group: GroupCreate,
    db: Session = Depends(get_db)
):
    """Create a new custom group."""
    # Check for duplicate name
    existing = db.query(Group).filter(Group.name == group.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")

    new_group = Group(
        name=group.name,
        description=group.description,
        color=group.color,
        is_system=False
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return GroupResponse(
        id=new_group.id,
        name=new_group.name,
        description=new_group.description,
        color=new_group.color,
        is_system=new_group.is_system,
        created_at=new_group.created_at,
        numbers_count=0
    )


@router.get("", response_model=List[GroupResponse])
async def list_groups(
    include_system: bool = Query(True, description="Include system-generated country groups"),
    db: Session = Depends(get_db)
):
    """List all groups."""
    query = db.query(Group)

    if not include_system:
        query = query.filter(Group.is_system == False)

    groups = query.order_by(Group.created_at.desc()).all()

    result = []
    for g in groups:
        count = len(g.numbers)
        result.append(GroupResponse(
            id=g.id,
            name=g.name,
            description=g.description,
            color=g.color,
            is_system=g.is_system,
            created_at=g.created_at,
            numbers_count=count
        ))

    return result


@router.get("/{group_id}", response_model=dict)
async def get_group(
    group_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Get a group with its numbers."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Paginate numbers
    total = len(group.numbers)
    start = (page - 1) * limit
    end = start + limit
    numbers = group.numbers[start:end]

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "color": group.color,
        "is_system": group.is_system,
        "created_at": group.created_at.isoformat(),
        "numbers_count": total,
        "numbers": [
            {
                "id": n.id,
                "raw_number": n.raw_number,
                "normalized_number": n.normalized_number,
                "country_code": n.country_code,
                "country_name": n.country_name,
                "is_valid": n.is_valid
            }
            for n in numbers
        ],
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 1
    }


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    update: GroupUpdate,
    db: Session = Depends(get_db)
):
    """Update a group's name, color, or description."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.is_system:
        raise HTTPException(status_code=400, detail="Cannot modify system groups")

    if update.name is not None:
        # Check for duplicate
        existing = db.query(Group).filter(
            Group.name == update.name,
            Group.id != group_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Group name already exists")
        group.name = update.name

    if update.description is not None:
        group.description = update.description

    if update.color is not None:
        group.color = update.color

    db.commit()
    db.refresh(group)

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        color=group.color,
        is_system=group.is_system,
        created_at=group.created_at,
        numbers_count=len(group.numbers)
    )


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    db: Session = Depends(get_db)
):
    """Delete a group (does not delete the numbers)."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system groups")

    db.delete(group)
    db.commit()

    return {"message": "Group deleted successfully"}


@router.post("/{group_id}/numbers")
async def add_numbers_to_group(
    group_id: str,
    data: AddNumbersToGroup,
    db: Session = Depends(get_db)
):
    """Add numbers to a group."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    added = 0
    for number_id in data.number_ids:
        number = db.query(ExtractedNumber).filter(ExtractedNumber.id == number_id).first()
        if number and number not in group.numbers:
            group.numbers.append(number)
            added += 1

    db.commit()

    return {"added": added, "total_in_group": len(group.numbers)}


@router.delete("/{group_id}/numbers")
async def remove_numbers_from_group(
    group_id: str,
    number_ids: List[str],
    db: Session = Depends(get_db)
):
    """Remove numbers from a group."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    removed = 0
    for number_id in number_ids:
        number = db.query(ExtractedNumber).filter(ExtractedNumber.id == number_id).first()
        if number and number in group.numbers:
            group.numbers.remove(number)
            removed += 1

    db.commit()

    return {"removed": removed, "total_in_group": len(group.numbers)}


@router.post("/auto-create-country-groups")
async def create_country_groups(
    db: Session = Depends(get_db)
):
    """Auto-create system groups for each country in extracted numbers."""
    # Get unique countries
    countries = db.query(
        ExtractedNumber.country_code,
        ExtractedNumber.country_name
    ).filter(
        ExtractedNumber.country_code.isnot(None)
    ).distinct().all()

    created = 0
    for cc, cn in countries:
        if not cc:
            continue

        group_name = f"{cn or 'Unknown'} ({cc})"

        # Check if group exists
        existing = db.query(Group).filter(Group.name == group_name).first()
        if existing:
            continue

        # Create group
        group = Group(
            name=group_name,
            description=f"Auto-generated group for {cn or 'Unknown'}",
            color=get_country_color(cc),
            is_system=True
        )
        db.add(group)
        db.flush()

        # Add numbers to group
        numbers = db.query(ExtractedNumber).filter(
            ExtractedNumber.country_code == cc
        ).all()
        for num in numbers:
            group.numbers.append(num)

        created += 1

    db.commit()

    return {"created": created}


def get_country_color(country_code: str) -> str:
    """Return a color for a country code."""
    colors = {
        '+1': '#3B82F6',   # US/CA - Blue
        '+91': '#F97316',  # India - Orange
        '+44': '#EF4444',  # UK - Red
        '+61': '#10B981',  # Australia - Green
        '+971': '#8B5CF6', # UAE - Purple
        '+92': '#14B8A6',  # Pakistan - Teal
        '+880': '#F59E0B', # Bangladesh - Amber
    }
    return colors.get(country_code, '#6366F1')  # Default indigo

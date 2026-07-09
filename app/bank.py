"""Core banking operations the employee performs (accounts, ledger, transfers).

This is the 'real work' side of the demo: a privileged bank employee doing
day-to-day banking. Transfers actually move money between accounts and post to
the ledger; high-value transfers are held for maker-checker approval — a genuine
banking control. (This is separate from the privileged-access threat scoring,
which watches admin actions on core systems, not routine customer transfers.)
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session as OrmSession

from app.models.entities import BankAccount, BankTransaction

HIGH_VALUE = 200000.0   # transfers above this need a second approver (maker-checker)

SEED_ACCOUNTS = [
    ("50100000004821", "Aarti Deshpande", "Savings", "Fort", 245600.0, "ACTIVE"),
    ("50100000007735", "Meridian Traders Pvt Ltd", "Current", "BKC", 1890200.0, "ACTIVE"),
    ("50100000001188", "Rohan Kulkarni", "Savings", "Andheri", 76540.0, "DORMANT"),
    ("50100000009042", "Sana Sheikh", "Loan", "Fort", -420000.0, "ACTIVE"),
    ("50100000003357", "Vertex Exports", "Current", "Pune", 912780.0, "FROZEN"),
    ("50100000006610", "Kabir Nair", "Savings", "Thane", 158900.0, "ACTIVE"),
]

SEED_TX = [
    ("NEFT outward · vendor payout", "50100000007735", None, 120000.0, "NEFT"),
    ("IMPS inward · salary credit", None, "50100000004821", 8500.0, "IMPS"),
    ("RTGS outward · settlement", "50100000007735", None, 500000.0, "RTGS"),
    ("UPI collect · merchant", None, "50100000004821", 2240.0, "UPI"),
    ("Cheque clearing · inward", None, "50100000003357", 45000.0, "TRANSFER"),
    ("Standing instruction · EMI", "50100000009042", None, 32100.0, "TRANSFER"),
]


def mask(number: str) -> str:
    return f"AC ••••{number[-4:]}" if number else "—"


def seed_bank(db: OrmSession) -> None:
    """Populate accounts + a little ledger history (idempotent)."""
    if db.query(BankAccount).count() == 0:
        for num, holder, typ, branch, bal, status in SEED_ACCOUNTS:
            db.add(BankAccount(number=num, holder=holder, acc_type=typ, branch=branch,
                               balance=bal, status=status))
    if db.query(BankTransaction).count() == 0:
        base = datetime.now().replace(hour=9, minute=32, second=0, microsecond=0)
        for i, (desc, frm, to, amt, mode) in enumerate(SEED_TX):
            db.add(BankTransaction(timestamp=base - timedelta(minutes=17 * i), description=desc,
                                   from_number=frm, to_number=to, amount=amt, mode=mode,
                                   status="CLEARED", maker="system"))
    db.commit()


def _acct(db: OrmSession, number: str) -> BankAccount | None:
    return db.query(BankAccount).filter_by(number=number).first()


def accounts(db: OrmSession) -> list[dict]:
    rows = db.query(BankAccount).order_by(BankAccount.id).all()
    return [{"number": a.number, "masked": mask(a.number), "holder": a.holder,
             "type": a.acc_type, "branch": a.branch, "balance": a.balance,
             "status": a.status} for a in rows]


def transactions(db: OrmSession, limit: int = 25) -> list[dict]:
    rows = (db.query(BankTransaction).order_by(BankTransaction.timestamp.desc(),
            BankTransaction.id.desc()).limit(limit).all())
    return [_tx_dict(t) for t in rows]


def pending(db: OrmSession) -> list[dict]:
    rows = (db.query(BankTransaction).filter_by(status="HELD")
            .order_by(BankTransaction.id.desc()).all())
    return [_tx_dict(t) for t in rows]


def _tx_dict(t: BankTransaction) -> dict:
    return {"id": t.id, "t": t.timestamp.isoformat(), "description": t.description,
            "from": mask(t.from_number), "to": mask(t.to_number), "amount": t.amount,
            "mode": t.mode, "status": t.status, "maker": t.maker}


class TransferError(Exception):
    pass


def transfer(db: OrmSession, from_number: str, to_number: str, amount: float,
             mode: str, maker: str) -> dict:
    """Move funds between accounts. High-value transfers are held for approval."""
    if amount <= 0:
        raise TransferError("Amount must be greater than zero.")
    if from_number == to_number:
        raise TransferError("Source and destination accounts must differ.")
    src = _acct(db, from_number)
    dst = _acct(db, to_number)
    if src is None or dst is None:
        raise TransferError("Account not found.")
    if src.status != "ACTIVE":
        raise TransferError(f"Source account is {src.status} — cannot debit.")
    if dst.status == "FROZEN":
        raise TransferError("Destination account is FROZEN — cannot credit.")
    if amount > src.balance and src.acc_type != "Loan":
        raise TransferError("Insufficient balance.")

    desc = f"{mode} transfer · {src.holder} → {dst.holder}"
    if amount > HIGH_VALUE:
        tx = BankTransaction(description=desc, from_number=from_number, to_number=to_number,
                             amount=amount, mode=mode, status="HELD", maker=maker)
        db.add(tx)
        db.commit()
        return {"status": "HELD", "transaction": _tx_dict(tx),
                "message": f"₹{amount:,.0f} exceeds the ₹{HIGH_VALUE:,.0f} maker-checker "
                           "limit — held for a second approver."}
    _settle(src, dst, amount)
    tx = BankTransaction(description=desc, from_number=from_number, to_number=to_number,
                         amount=amount, mode=mode, status="CLEARED", maker=maker)
    db.add(tx)
    db.commit()
    return {"status": "CLEARED", "transaction": _tx_dict(tx),
            "message": f"₹{amount:,.0f} transferred and cleared."}


def approve(db: OrmSession, tx_id: int, approver: str) -> dict:
    tx = db.get(BankTransaction, tx_id)
    if tx is None or tx.status != "HELD":
        raise TransferError("No held transaction with that id.")
    src, dst = _acct(db, tx.from_number), _acct(db, tx.to_number)
    if src is None or dst is None:
        raise TransferError("Account not found.")
    if amount_ok := (src.acc_type == "Loan" or tx.amount <= src.balance):
        _settle(src, dst, tx.amount)
        tx.status = "CLEARED"
        db.commit()
        return {"status": "CLEARED", "transaction": _tx_dict(tx)}
    raise TransferError("Insufficient balance at approval time.")


def reject(db: OrmSession, tx_id: int) -> dict:
    tx = db.get(BankTransaction, tx_id)
    if tx is None or tx.status != "HELD":
        raise TransferError("No held transaction with that id.")
    tx.status = "REJECTED"
    db.commit()
    return {"status": "REJECTED", "transaction": _tx_dict(tx)}


def _settle(src: BankAccount, dst: BankAccount, amount: float) -> None:
    src.balance -= amount
    dst.balance += amount

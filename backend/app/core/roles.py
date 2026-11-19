"""Pemetaan antara enum role di database dan label yang dipakai frontend."""

ROLE_LABEL = {
    "OPERATOR": "Operator",
    "MANAJEMEN": "Manajemen",
    "ADMIN": "Admin",
}

ROLE_DB = {label: code for code, label in ROLE_LABEL.items()}


def role_label(code: str) -> str:
    return ROLE_LABEL[code]

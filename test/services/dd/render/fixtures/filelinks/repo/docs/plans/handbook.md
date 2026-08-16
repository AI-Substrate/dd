# Handbook

The document-relative half of the file-link fixture. `notes.dd.json` reaches this
file as `../handbook.md`, which is exactly the href its generated sibling emits —
the existence check and the rendered link resolve the same bytes against the same
directory, or one of them is lying.

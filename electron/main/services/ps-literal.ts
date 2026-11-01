/** Literal de string para PowerShell: aspas simples, com `''` para aspas internas. */
export function psLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Nome entre aspas duplas, para comandos como `sc.exe config "Nome" start= ...`. */
export function psDoubleQuoted(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

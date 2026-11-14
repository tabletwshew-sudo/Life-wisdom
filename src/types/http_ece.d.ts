declare module 'http_ece' {
  const ece: { decrypt(buf: Buffer, params: Record<string, unknown>): Buffer }
  export default ece
}

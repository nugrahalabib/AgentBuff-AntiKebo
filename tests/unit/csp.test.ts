import { describe, expect, it } from "vitest";
import { kebijakanCsp } from "@/lib/keamanan/csp";

describe("CSP", () => {
  it("nonce, tanpa unsafe-eval di produksi, frame-ancestors none, form-action ke AgentBuff", () => {
    const p = kebijakanCsp("abc", { dev: false, agentbuffOrigin: "https://agentbuff.id" });
    expect(p).toContain("script-src 'self' 'nonce-abc'");
    expect(p).not.toContain("unsafe-eval");
    expect(p).toContain("frame-ancestors 'none'");
    expect(p).toContain("form-action 'self' https://agentbuff.id");
    expect(p).toContain("media-src 'self' blob:");
    expect(kebijakanCsp("abc", { dev: true, agentbuffOrigin: "x" })).toContain("'unsafe-eval'");
  });
});

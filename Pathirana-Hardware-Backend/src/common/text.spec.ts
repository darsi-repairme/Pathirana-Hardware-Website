import { likePattern, normaliseSearch, slugify } from "./text";

describe("text helpers", () => {
  it("slugifies real catalogue names", () => {
    expect(slugify("Doors & Windows")).toBe("doors-windows");
    expect(slugify("Würth")).toBe("wurth");
    expect(slugify("PE+")).toBe("pe-plus");
    expect(slugify("El Toro")).toBe("el-toro");
    expect(slugify("  --  ")).toBe("");
  });

  it("normalises visitor input", () => {
    expect(normaliseSearch("  Bangadeniya   North ")).toBe("bangadeniya north");
  });

  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

import { describe, expect, it } from "vitest";
import { buildDescriptiveAddress } from "./addressFormatting";

describe("buildDescriptiveAddress", () => {
  it("removes country and governorate noise", () => {
    expect(
      buildDescriptiveAddress("شارع 20، حي التأميم، الرمادي، محافظة الأنبار، العراق"),
    ).toBe("شارع 20، حي التأميم، الرمادي");
  });

  it("drops plus codes before formatting", () => {
    expect(buildDescriptiveAddress("8F3Q+22، شارع 40، الرمادي، العراق")).toBe(
      "شارع 40، الرمادي",
    );
  });

  it("does not expose loading placeholder text", () => {
    expect(buildDescriptiveAddress("جاري تحديد العنوان...")).toBe("");
  });
});

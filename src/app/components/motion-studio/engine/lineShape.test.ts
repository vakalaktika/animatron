import { chunksMarkup } from "./lineShape";

describe("chunksMarkup", () => {
  it("writes one path per chunk", () => {
    expect(chunksMarkup([{ d: "M0,0 L1,1Z", color: "#ff0000", opacity: 1 }])).toBe('<path d="M0,0 L1,1Z" fill="#ff0000" fill-opacity="1.000"/>');
  });

  it("escapes a colour that tries to close the attribute, since the markup goes into innerHTML", () => {
    const markup = chunksMarkup([{ d: "M0,0", color: 'x"/><animate onbegin="alert(1)"', opacity: 0.5 }]);
    expect(markup).toBe('<path d="M0,0" fill="x&quot;/&gt;&lt;animate onbegin=&quot;alert(1)&quot;" fill-opacity="0.500"/>');
    expect(markup.match(/</g)).toHaveLength(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthedImage } from "@/components/AuthedImage";

const getFileBlob = vi.fn();
vi.mock("@/lib/useApi", () => ({
  useApi: () => ({ getFileBlob }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:fake-url"),
    revokeObjectURL: vi.fn(),
  });
});

describe("AuthedImage", () => {
  it("fetches the file blob with the token hook and renders an img with the object URL", async () => {
    getFileBlob.mockResolvedValue(new Blob(["x"], { type: "image/png" }));

    render(<AuthedImage id="att-1" alt="my photo" className="thumb" />);

    const img = (await screen.findByAltText("my photo")) as HTMLImageElement;
    expect(getFileBlob).toHaveBeenCalledWith("att-1");
    expect(img.src).toContain("blob:fake-url");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput } from "@/components/MessageInput";

const uploadFile = vi.fn();
vi.mock("@/lib/useApi", () => ({
  useApi: () => ({ uploadFile }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  });
});

describe("MessageInput", () => {
  it("uploads a selected image and sends its attachment id", async () => {
    uploadFile.mockResolvedValue({ id: "att-1", filename: "pic.png", mimeType: "image/png" });
    const onSend = vi.fn();
    const user = userEvent.setup();

    const { container } = render(<MessageInput onSend={onSend} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["bytes"], "pic.png", { type: "image/png" });
    await user.upload(fileInput, file);

    expect(uploadFile).toHaveBeenCalledWith(file);
    // pending thumbnail appears
    expect(await screen.findByAltText("pic.png")).toBeInTheDocument();

    // typing + send forwards the attachment id
    await user.type(screen.getByPlaceholderText("Message…"), "look at this");
    await user.click(screen.getByLabelText("Send"));

    expect(onSend).toHaveBeenCalledWith("look at this", ["att-1"]);
  });
});

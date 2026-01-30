import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SceneEditor } from "~/components/domain/scene-editor";

describe("SceneEditor", () => {
  const mockScene = {
    id: "scene-1",
    duration: 5,
    onScreenText: "Original text",
    voiceoverText: "Original voiceover",
    assetSuggestions: [],
  };

  it("should render with initial scene values", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <SceneEditor scene={mockScene} onSave={onSave} onCancel={onCancel} />,
    );

    expect(screen.getByLabelText(/duration/i)).toHaveValue(5);
    expect(screen.getByLabelText(/on-screen text/i)).toHaveValue(
      "Original text",
    );
    expect(screen.getByLabelText(/voiceover text/i)).toHaveValue(
      "Original voiceover",
    );
  });

  it("should update field values when user types", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <SceneEditor scene={mockScene} onSave={onSave} onCancel={onCancel} />,
    );

    const durationInput = screen.getByLabelText(/duration/i);
    const textInput = screen.getByLabelText(/on-screen text/i);
    const voiceoverInput = screen.getByLabelText(/voiceover text/i);

    await user.clear(durationInput);
    await user.type(durationInput, "7.5");

    await user.clear(textInput);
    await user.type(textInput, "New text");

    await user.clear(voiceoverInput);
    await user.type(voiceoverInput, "New voiceover");

    expect(durationInput).toHaveValue(7.5);
    expect(textInput).toHaveValue("New text");
    expect(voiceoverInput).toHaveValue("New voiceover");
  });

  it("should call onSave with updated values when save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <SceneEditor scene={mockScene} onSave={onSave} onCancel={onCancel} />,
    );

    const durationInput = screen.getByLabelText(/duration/i);
    const textInput = screen.getByLabelText(/on-screen text/i);
    const voiceoverInput = screen.getByLabelText(/voiceover text/i);

    await user.clear(durationInput);
    await user.type(durationInput, "10");

    await user.clear(textInput);
    await user.type(textInput, "Updated text");

    await user.clear(voiceoverInput);
    await user.type(voiceoverInput, "Updated voiceover");

    const form = screen
      .getByRole("button", { name: /save changes/i })
      .closest("form");
    fireEvent.submit(form!);

    expect(onSave).toHaveBeenCalledWith({
      duration: 10,
      onScreenText: "Updated text",
      voiceoverText: "Updated voiceover",
    });
  });

  it("should call onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <SceneEditor scene={mockScene} onSave={onSave} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("should not call onSave with invalid duration", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <SceneEditor scene={mockScene} onSave={onSave} onCancel={onCancel} />,
    );

    await user.clear(screen.getByLabelText(/duration/i));
    await user.type(screen.getByLabelText(/duration/i), "-5");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).not.toHaveBeenCalled();
  });
});

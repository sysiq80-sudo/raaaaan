import { useState, useEffect } from "react";
import { Keyboard } from "@capacitor/keyboard";
import { isNativePlatform } from "@/lib/capacitorBridge";

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isNativePlatform) return;

    let willShowListener: any = null;
    let willHideListener: any = null;

    const setupListeners = async () => {
      try {
        willShowListener = await Keyboard.addListener("keyboardWillShow", (info) => {
          setKeyboardHeight(info.keyboardHeight);
        });

        willHideListener = await Keyboard.addListener("keyboardWillHide", () => {
          setKeyboardHeight(0);
        });
      } catch (err) {
        console.warn("Keyboard listeners setup failed:", err);
      }
    };

    setupListeners();

    return () => {
      if (willShowListener) {
        willShowListener.remove();
      }
      if (willHideListener) {
        willHideListener.remove();
      }
    };
  }, []);

  return keyboardHeight;
}

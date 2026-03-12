"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const resolved = theme === "system" ? systemTheme : theme;
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <Button
      variant="outline"
      onClick={() => setTheme(next)}
      type="button"
    >
      {resolved === "dark" ? "Light" : "Dark"}
    </Button>
  );
}


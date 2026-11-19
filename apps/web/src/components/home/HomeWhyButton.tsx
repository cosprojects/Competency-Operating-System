"use client";

import { useState } from "react";
import { WhyDialog } from "@/components/WhyDialog";

/** Кнопка «Зачем все это?» на главной — открывает модалку о продукте. */
export function HomeWhyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button secondary home2-hero-secondary" type="button" onClick={() => setOpen(true)}>
        Зачем все это?
      </button>
      <WhyDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

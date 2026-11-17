"use client";

import { useState } from "react";
import { getLegalDocument } from "@/content/legal";

/** Модалка с описанием cookie вместо отдельной страницы. */
export function CookieModalLink() {
  const [open, setOpen] = useState(false);
  const document = getLegalDocument("cookies");

  return (
    <>
      <button className="site-footer-link" type="button" onClick={() => setOpen(true)}>
        Cookies
      </button>
      {open && document ? (
        <div
          className="cookie-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookie-modal-title">
            <button className="cookie-modal-close" type="button" onClick={() => setOpen(false)} aria-label="Закрыть">
              ×
            </button>
            <h2 id="cookie-modal-title">{document.title}</h2>
            <div className="cookie-modal-scroll">
              {document.sections.map((section) => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

"use client";

import {
  Infobar,
  InfobarContent,
  InfobarGroup,
  InfobarGroupContent,
  InfobarHeader,
  InfobarRail,
  InfobarTrigger,
  useInfobar,
} from "../ui/infobar";

export function InfoSidebar({ ...props }: React.ComponentProps<typeof Infobar>) {
  const { content } = useInfobar();

  return (
    <Infobar {...props}>
      <InfobarHeader className="bg-sidebar sticky top-0 z-10 flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="min-w-0 flex-1 text-lg font-semibold wrap-break-word">
          {content?.title ?? "Información"}
        </h2>
        <InfobarTrigger />
      </InfobarHeader>
      <InfobarContent>
        <InfobarGroup>
          <InfobarGroupContent>
            {content?.sections.length ? (
              <div className="flex flex-col gap-6 px-4 py-4">
                {content.sections.map((section) => (
                  <section className="flex flex-col gap-2" key={section.title}>
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {section.description}
                    </p>
                  </section>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground px-6 py-10 text-center text-sm leading-relaxed">
                No hay información adicional para esta pantalla.
              </div>
            )}
          </InfobarGroupContent>
        </InfobarGroup>
      </InfobarContent>
      <InfobarRail />
    </Infobar>
  );
}

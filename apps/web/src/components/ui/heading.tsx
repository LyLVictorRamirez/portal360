import { InfoButton } from "@/components/ui/info-button";
import type { InfobarContent } from "@/components/ui/infobar";

interface HeadingProps {
  as?: "h1" | "h2";
  title: string;
  description: string;
  infoContent?: InfobarContent;
}

export function Heading({ as = "h2", title, description, infoContent }: HeadingProps) {
  const Title = as;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Title className="text-3xl font-bold tracking-tight">{title}</Title>
        {infoContent && (
          <div className="pt-1">
            <InfoButton content={infoContent} />
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Theme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const currentIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4 text-warning" />;
      case "dark":
        return <Moon className="h-4 w-4 text-accent" />;
      case "system":
        return <Monitor className="h-4 w-4 text-text-secondary" />;
    }
  };

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-text-secondary hover:text-text-primary focus-visible:ring-1"
                aria-label="Toggle theme"
              >
                {currentIcon()}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>Switch theme (current: {theme})</span>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("dark" as Theme)}>
            <Moon className="mr-2 h-4 w-4 text-accent" />
            <span>Dark</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("light" as Theme)}>
            <Sun className="mr-2 h-4 w-4 text-warning" />
            <span>Light</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system" as Theme)}>
            <Monitor className="mr-2 h-4 w-4 text-text-secondary" />
            <span>System Default</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

import { cn } from '@/lib/utils';
import { channelIcons, ChannelIconOption } from './channelIcons';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ChannelIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
}

export function ChannelIconPicker({ value, onChange, disabled }: ChannelIconPickerProps) {
  const selectedIcon = channelIcons.find(i => i.name === value) || channelIcons[0];
  const IconComponent = selectedIcon.icon;

  return (
    <Popover modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-10 p-0 border-slate-600 bg-slate-700 hover:bg-slate-600"
          disabled={disabled}
        >
          <IconComponent className="h-5 w-5 text-teal-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-2 border-slate-600 bg-slate-700 z-[100]" 
        align="start"
        sideOffset={8}
      >
        <div className="grid grid-cols-5 gap-1">
          {channelIcons.map((iconOption) => {
            const Icon = iconOption.icon;
            return (
              <button
                key={iconOption.name}
                onClick={() => onChange(iconOption.name)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                  value === iconOption.name
                    ? "bg-teal-500/20 text-teal-400"
                    : "text-slate-400 hover:bg-slate-600 hover:text-white"
                )}
                title={iconOption.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

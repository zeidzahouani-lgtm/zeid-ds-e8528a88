import { useState } from "react";
import { Input } from "@/components/ui/input";
import { validatePassword, getPasswordStrength } from "@/lib/password-validation";
import { Eye, EyeOff, Check, X, Shuffle, Copy } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showRules?: boolean;
}

const rules = [
  { test: (p: string) => p.length >= 8, label: "8 caractères minimum" },
  { test: (p: string) => /[A-Z]/.test(p), label: "Une majuscule" },
  { test: (p: string) => /[a-z]/.test(p), label: "Une minuscule" },
  { test: (p: string) => /[0-9]/.test(p), label: "Un chiffre" },
  { test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p), label: "Un symbole (!@#$%...)" },
];

function generateSecurePassword(length = 16): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%&*?+-_";
  const all = upper + lower + digits + symbols;
  const mandatory = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  const rest = Array.from({ length: length - mandatory.length }, () =>
    all[Math.floor(Math.random() * all.length)]
  );
  return [...mandatory, ...rest].sort(() => Math.random() - 0.5).join("");
}

export function PasswordInput({ value, onChange, placeholder = "Min. 8 caractères", showRules = true }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const strength = getPasswordStrength(value);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-20"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(value);
                    toast.success("Mot de passe copié !");
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Copier</p></TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  const pw = generateSecurePassword();
                  onChange(pw);
                  setShowPassword(true);
                }}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Générer un mot de passe</p></TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {showRules && value.length > 0 && (
        <div className="space-y-1.5">
          {/* Strength bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                style={{ width: `${strength.percent}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium min-w-[60px] text-right">
              {strength.label}
            </span>
          </div>

          {/* Rules checklist */}
          <ul className="space-y-0.5">
            {rules.map((rule) => {
              const passed = rule.test(value);
              return (
                <li key={rule.label} className={`flex items-center gap-1.5 text-[11px] transition-colors ${passed ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

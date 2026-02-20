import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { FormGroup, FormItem } from "@/components/ui/form-components";
import { StepNavigation } from "@/components/ui/step-wizard";

interface MemberInfoStepProps {
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  errors: Record<string, string>;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  onNext: () => boolean;
}

export function MemberInfoStep({
  name,
  setName,
  email,
  setEmail,
  phoneNumber,
  setPhoneNumber,
  password,
  setPassword,
  errors,
  showPassword,
  setShowPassword,
  onNext,
}: MemberInfoStepProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Informações do Membro</h3>
            <p className="text-sm text-muted-foreground">
              Nome, email e senha inicial
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <FormGroup>
            <FormItem
              label="Nome Completo"
              htmlFor="member-name"
              required
              error={errors.name}
            >
              <Input
                id="member-name"
                name="member_name_new"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maria Silva"
                icon={<User className="w-4 h-4" />}
                required
                minLength={2}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className={errors.name ? "border-destructive" : ""}
              />
            </FormItem>

            <FormItem
              label="Email"
              htmlFor="member-email"
              required
              error={errors.email}
            >
              <Input
                id="member-email"
                name="member_email_new"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@empresa.com"
                icon={<Mail className="w-4 h-4" />}
                required
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className={errors.email ? "border-destructive" : ""}
              />
            </FormItem>
          </FormGroup>

          <FormItem
            label="WhatsApp / Telefone"
            htmlFor="member-phone"
            error={errors.phoneNumber}
          >
            <PhoneInput
              id="member-phone"
              name="member_phone_new"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              autoComplete="off"
            />
          </FormItem>

          <FormItem
            label="Senha Inicial"
            htmlFor="member-password"
            required
            hint="O membro poderá alterá-la depois"
            error={errors.password}
          >
            <div className="relative">
              <Input
                id="member-password"
                name="member_password_new"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Defina uma senha provisória"
                icon={<Lock className="w-4 h-4" />}
                required
                minLength={6}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
                className={
                  errors.password
                    ? "border-destructive pr-10"
                    : "bg-primary/5 border-primary/20 focus:bg-background pr-10"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </FormItem>
        </div>
      </div>
      <StepNavigation onBeforeNext={onNext} />
    </>
  );
}

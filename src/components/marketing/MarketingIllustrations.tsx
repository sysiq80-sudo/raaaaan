import logo from "@/assets/logo.png";

const Line = ({ className }: { className?: string }) => (
  <div className={`h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent ${className ?? ""}`} />
);

export const AIOrbIllustration = () => (
  <div className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center overflow-hidden rounded-[2rem] border border-primary/20 bg-card/70 p-10 shadow-glow-lg">
    <div className="absolute inset-0 dots-pattern opacity-30" />
    <div className="absolute h-72 w-72 rounded-full bg-primary/10 blur-[90px]" />
    <div className="absolute inset-10 rounded-[2rem] border border-primary/20" />
    <div className="absolute left-10 top-10 h-24 w-24 rounded-full border border-primary/20 bg-background/70 blur-sm" />
    <div className="absolute bottom-10 right-10 h-28 w-28 rounded-full border border-primary/20 bg-background/70 blur-sm" />
    <div className="relative z-10 flex w-full max-w-xs flex-col gap-5 rounded-[2rem] border border-primary/20 bg-background/80 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">AI Core</span>
        <span className="text-xs text-muted-foreground">Voice to Ride</span>
      </div>
      <div className="space-y-3">
        <div className="h-3 rounded-full bg-primary/15">
          <div className="h-3 w-3/4 rounded-full bg-gradient-primary" />
        </div>
        <div className="h-3 rounded-full bg-primary/10">
          <div className="h-3 w-2/3 rounded-full bg-primary/70" />
        </div>
        <div className="h-3 rounded-full bg-primary/10">
          <div className="h-3 w-4/5 rounded-full bg-primary/50" />
        </div>
      </div>
      <Line />
      <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
        <div className="rounded-2xl border border-primary/15 bg-background/60 p-3">ASR</div>
        <div className="rounded-2xl border border-primary/15 bg-background/60 p-3">NLP</div>
        <div className="rounded-2xl border border-primary/15 bg-background/60 p-3">Maps</div>
      </div>
    </div>
  </div>
);

export const CityGridIllustration = () => (
  <div className="relative mx-auto grid aspect-[1.05] w-full max-w-[440px] grid-cols-6 gap-3 overflow-hidden rounded-[2rem] border border-primary/20 bg-card/60 p-6 shadow-glow">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(160_100%_50%_/_0.12),_transparent_55%)]" />
    {Array.from({ length: 24 }).map((_, index) => (
      <div
        key={index}
        className={`relative rounded-2xl border ${index % 5 === 0 ? "border-primary/50 bg-primary/15" : "border-primary/15 bg-background/70"}`}
      />
    ))}
    <div className="absolute left-8 top-8 rounded-full border border-primary/30 bg-background/80 px-3 py-2 text-xs text-primary">Ramadi network</div>
    <div className="absolute bottom-8 right-8 rounded-2xl border border-primary/25 bg-background/80 px-4 py-3 text-sm text-foreground">
      <div className="font-semibold">27+ landmarks</div>
      <div className="text-xs text-muted-foreground">Route-aware booking map</div>
    </div>
  </div>
);

export const DriverConsoleIllustration = () => (
  <div className="relative mx-auto flex aspect-[1.08] w-full max-w-[440px] flex-col overflow-hidden rounded-[2rem] border border-primary/20 bg-card/70 p-6 shadow-glow">
    <div className="absolute inset-0 dots-pattern opacity-25" />
    <div className="mb-5 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-foreground">Captain Console</div>
        <div className="text-xs text-muted-foreground">Realtime earnings and requests</div>
      </div>
      <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">Online</div>
    </div>
    <div className="grid flex-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[1.5rem] border border-primary/15 bg-background/70 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Today</span>
          <span className="text-lg font-bold text-primary">125,000 IQD</span>
        </div>
        <div className="space-y-3">
          {[78, 56, 90, 64].map((value, index) => (
            <div key={value} className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Zone {index + 1}</div>
              <div className="h-2 rounded-full bg-primary/10">
                <div className="h-2 rounded-full bg-gradient-primary" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-primary/15 bg-background/70 p-4">
          <div className="text-xs text-muted-foreground">Acceptance rate</div>
          <div className="mt-2 text-3xl font-bold text-foreground">98%</div>
        </div>
        <div className="rounded-[1.5rem] border border-primary/15 bg-background/70 p-4">
          <div className="text-xs text-muted-foreground">Trips</div>
          <div className="mt-2 text-3xl font-bold text-foreground">12</div>
        </div>
        <div className="rounded-[1.5rem] border border-primary/15 bg-background/70 p-4">
          <div className="text-xs text-muted-foreground">Rating</div>
          <div className="mt-2 text-3xl font-bold text-foreground">4.9</div>
        </div>
      </div>
    </div>
  </div>
);

export const StoryIllustration = () => (
  <div className="relative mx-auto flex aspect-[1.05] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-[2rem] border border-primary/20 bg-card/70 p-8 shadow-glow">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_hsl(160_100%_50%_/_0.12),_transparent_40%),radial-gradient(circle_at_80%_70%,_hsl(160_100%_50%_/_0.1),_transparent_35%)]" />
    <div className="relative z-10 flex w-full flex-col gap-4 rounded-[2rem] border border-primary/20 bg-background/80 p-6">
      <div className="flex items-center gap-3">
        <img src={logo} alt="RAAN" className="h-12 w-12 rounded-2xl shadow-glow-sm" />
        <div>
          <div className="text-sm font-semibold text-foreground">RAAN Origin</div>
          <div className="text-xs text-muted-foreground">Built in Ramadi for Anbar streets</div>
        </div>
      </div>
      <Line />
      <div className="grid gap-3 sm:grid-cols-3">
        {["Local roots", "AI voice flow", "Safe mobility"].map((item) => (
          <div key={item} className="rounded-2xl border border-primary/15 bg-background/60 p-4 text-center text-xs text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ContactBridgeIllustration = () => (
  <div className="relative mx-auto flex aspect-[1.05] w-full max-w-[440px] items-center justify-center overflow-hidden rounded-[2rem] border border-primary/20 bg-card/70 p-8 shadow-glow">
    <div className="absolute inset-0 dots-pattern opacity-25" />
    <div className="absolute h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
    <div className="relative z-10 grid w-full gap-4 sm:grid-cols-2">
      <div className="rounded-[1.5rem] border border-primary/15 bg-background/75 p-5">
        <div className="text-sm font-semibold text-foreground">Support Hub</div>
        <div className="mt-2 text-xs leading-6 text-muted-foreground">Fast replies across WhatsApp, Telegram, email, and direct calls.</div>
      </div>
      <div className="rounded-[1.5rem] border border-primary/15 bg-background/75 p-5">
        <div className="text-sm font-semibold text-foreground">24/7 Ready</div>
        <div className="mt-2 text-xs leading-6 text-muted-foreground">Operations and care teams stay connected to riders and captains.</div>
      </div>
    </div>
  </div>
);

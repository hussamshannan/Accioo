import { SignIn, SignUp, useUser } from "@clerk/react";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Navigate } from "react-router-dom";
import gsap from "gsap";
import Spline from "@splinetool/react-spline";
import ShinyText from "@/components/ui/ShinyText";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const SCENE_DESKTOP =
  "https://prod.spline.design/91IF-tZHO1Goh4b0/scene.splinecode";
const SCENE_MOBILE =
  "https://prod.spline.design/MNy9pyp-kwnNsv4T/scene.splinecode";

const clerkAppearance = {
  variables: {
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.07)",
    colorInputText: "#ffffff",
    colorText: "#ffffff",
    colorTextSecondary: "#ffffff",
    colorTextOnPrimaryBackground: "#ffffff",
    colorPrimary: "#E8751A",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    colorNeutral: "#ffffff",
    borderRadius: "0.625rem",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    spacingUnit: "0.95rem",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: { width: "100%" },
    card: {
      background: "transparent",
      boxShadow: "none",
      border: "none",
      padding: "1rem 1.25rem 1rem",
      width: "100%",
      borderRadius: "0",
    },
    headerTitle: { color: "#ffffff", fontSize: "1.05rem", fontWeight: "600" },
    headerSubtitle: { color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" },

    formFieldLabel: { color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" },
    formFieldInput: {
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#ffffff",
      borderRadius: "0.625rem",
      fontSize: "0.875rem",
      padding: "0.65rem 0.9rem",
    },
    formFieldInputShowPasswordButton: { color: "rgba(255,255,255,0.45)" },
    formFieldErrorText: { color: "#f87171", fontSize: "0.72rem" },

    formButtonPrimary: {
      background: "linear-gradient(135deg, #E8751A, #D4621A)",
      borderRadius: "999px",
      fontSize: "0.875rem",
      fontWeight: "600",
      boxShadow: "none",
      color: "#ffffff",
    },

    socialButtonsBlockButton: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "0.625rem",
      color: "#ffffff",
    },
    socialButtonsBlockButtonText: {
      color: "rgba(255,255,255,0.75)",
      fontSize: "0.8rem",
    },
    socialButtonsBlockButtonArrow: { color: "rgba(255,255,255,0.3)" },

    dividerLine: { background: "rgba(255,255,255,0.08)" },
    dividerText: { color: "rgba(255,255,255,0.45)", fontSize: "0.72rem" },

    footer: {
      background: "transparent",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      justifyContent: "center",
      borderRadius: "0",
    },
    footerAction: { background: "transparent", justifyContent: "center" },
    footerActionText: { color: "rgba(255,255,255,0.6)", fontSize: "0.78rem" },
    footerActionLink: {
      color: "#ffffff",
      fontWeight: "600",
      fontSize: "0.78rem",
    },
    footerPages: { background: "transparent" },
    footerPagesLink: { color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" },
    footerItem: { color: "rgba(255,255,255,0.5)", fontSize: "0.7rem" },

    badge: {
      background: "rgba(255,255,255,0.1)",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "999px",
      fontSize: "0.65rem",
      fontWeight: "600",
      padding: "1px 6px",
    },

    socialButtonsProviderIcon__apple: { filter: "invert(1)" },
    identityPreviewText: { color: "rgba(255,255,255,0.65)" },
    identityPreviewEditButton: { color: "#00A884" },
    alertText: { fontSize: "0.78rem" },
    otpCodeFieldInput: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#ffffff",
      borderRadius: "0.5rem",
    },
  },
};

function removeSplineWatermark() {
  const selectors = ["#logo", "a[href*='spline.design']", "a[href*='spline']"];
  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  });
}

export default function AuthPage() {
  const { isSignedIn } = useUser();
  const [mode, setMode] = useState("signin");
  const loaderRef = useRef(null);
  const brandRef = useRef(null);
  const cardRef = useRef(null);
  const formTimerRef = useRef(null);
  const cardShown = useRef(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Watch DOM for Spline watermark and remove it whenever it appears */
  useEffect(() => {
    removeSplineWatermark();
    const observer = new MutationObserver(removeSplineWatermark);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  /* Cleanup timer on unmount */
  useEffect(() => {
    return () => {
      if (formTimerRef.current) clearTimeout(formTimerRef.current);
    };
  }, []);

  /* Set initial hidden state before paint */
  useLayoutEffect(() => {
    gsap.set([brandRef.current, cardRef.current], { opacity: 0, y: 28 });
  }, []);

  /* Animate card on tab switch (only after card is visible) */
  const initialMode = useRef(mode);
  useLayoutEffect(() => {
    if (!cardRef.current || !cardShown.current) return;
    if (mode === initialMode.current) {
      initialMode.current = null;
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0.7, y: 8 },
        { opacity: 1, y: 0, duration: 0.22 },
      );
    });
    return () => ctx.revert();
  }, [mode]);

  /* Called when Spline finishes loading */
  const handleSplineLoad = () => {
    // Fade out the loader
    gsap.to(loaderRef.current, {
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => {
        if (loaderRef.current) loaderRef.current.style.display = "none";
      },
    });

    // Animate brand in immediately
    gsap.to(brandRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.65,
      ease: "power3.out",
      delay: 0.25,
    });

    // Show card after 3.5 second delay
    formTimerRef.current = setTimeout(() => {
      cardShown.current = true;
      gsap.to(cardRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "back.out(1.7)",
      });
    }, 3500);
  };

  if (isSignedIn) return <Navigate to="/" replace />;

  return (
    <div
      className="relative w-full min-h-screen overflow-hidden"
      style={{ background: "#060a10" }}
    >
      {/* ── Spline full-viewport background ───────────────────────── */}
      <div id="spline-container" className="absolute inset-0 overflow-hidden">
        <Spline
          key={isMobile ? "mobile" : "desktop"}
          scene={isMobile ? SCENE_MOBILE : SCENE_DESKTOP}
          onLoad={handleSplineLoad}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* ── Edge vignette (improves card legibility) ───────────────── */}
      <div className="absolute inset-0 pointer-events-none" />

      {/* ── Loading screen ─────────────────────────────────────────── */}
      <div
        ref={loaderRef}
        className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6"
        style={{ background: "#060a10" }}
      >
        <h1 className="text-4xl font-bold select-none">
          <ShinyText>Accioo</ShinyText>
        </h1>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "#00A884",
                animation: `pulse 1.3s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Auth panel ──────────────────────────────────────────────── */}
      <div className="pointer-events-none relative z-10 flex min-h-screen items-center justify-center md:justify-end md:pr-14 lg:pr-24 px-4 py-8 md:py-0">
        <div className="pointer-events-auto w-full max-w-[420px] md:max-w-[390px] flex flex-col gap-5">
          {/* Brand */}
          <div ref={brandRef} className="text-center select-none" />

          {/* Glass card — shadcn Card + Tabs */}
          <Card
            ref={cardRef}
            className="w-full overflow-hidden border-0 shadow-none rounded-2xl md:rounded-3xl"
            style={{
              background: "rgba(6, 10, 16, 0.72)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
          >
            <CardContent className="p-0">
              <Tabs value={mode} onValueChange={setMode} className="w-full">
                {/* Tab switcher */}
                <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-0">
                  <TabsList className="w-full h-11 p-1 gap-1 rounded-xl bg-white/[0.06]">
                    <TabsTrigger
                      value="signin"
                      className="flex-1 rounded-lg h-full text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white/[0.13] data-[state=active]:text-white data-[state=active]:shadow-none text-white/[0.35] hover:text-white/60"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="flex-1 rounded-lg h-full text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white/[0.13] data-[state=active]:text-white data-[state=active]:shadow-none text-white/[0.35] hover:text-white/60"
                    >
                      Create Account
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Clerk form */}
                <TabsContent value="signin" className="m-0">
                  <SignIn
                    key="signin"
                    routing="hash"
                    fallbackRedirectUrl="/"
                    appearance={clerkAppearance}
                  />
                </TabsContent>

                <TabsContent value="signup" className="m-0">
                  <SignUp
                    key="signup"
                    routing="hash"
                    fallbackRedirectUrl="/"
                    appearance={clerkAppearance}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

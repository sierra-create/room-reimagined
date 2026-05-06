import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import {
  generateRevampedRoom,
  suggestItems,
  type StyleKey,
  type ItemSuggestion,
} from "@/lib/generateRoom";
import { toast } from "@/hooks/use-toast";
import minimalistImg from "@/assets/style-minimalist.jpg";
import cozyImg from "@/assets/style-cozy.jpg";
import modernImg from "@/assets/style-modern.jpg";
import bohemianImg from "@/assets/style-bohemian.jpg";

type Step = "landing" | "upload" | "style" | "loading" | "results";

const STYLES: { key: StyleKey; name: string; description: string; image: string }[] = [
  { key: "minimalist", name: "Minimalist", description: "Clean, open, neutral tones", image: minimalistImg },
  { key: "cozy", name: "Cozy", description: "Warm, layered, soft textures", image: cozyImg },
  { key: "modern", name: "Modern", description: "Sleek, geometric, bold accents", image: modernImg },
  { key: "bohemian", name: "Bohemian", description: "Eclectic, plants, vibrant", image: bohemianImg },
];

const Header = () => (
  <header className="w-full px-6 py-5 flex items-center gap-2">
    <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold">R</div>
    <span className="font-bold text-lg tracking-tight">RoomRevamp</span>
  </header>
);

const Index = () => {
  const [step, setStep] = useState<Step>("landing");
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleKey | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ItemSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    },
  });

  const runGeneration = async (chosen: StyleKey) => {
    if (!image) return;
    setStyle(chosen);
    setSuggestions(null);
    setStep("loading");
    try {
      const out = await generateRevampedRoom(image, chosen);
      setResult(out);
      setStep("results");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Couldn't reorganize your room", description: msg });
      setStep("style");
    }
  };

  const reset = () => {
    setImage(null);
    setStyle(null);
    setResult(null);
    setSuggestions(null);
    setStep("landing");
  };

  // Lazy-load suggestions when results screen appears
  useEffect(() => {
    if (step !== "results" || !image || !style || suggestions !== null || loadingSuggestions) return;
    setLoadingSuggestions(true);
    suggestItems(image, style)
      .then(setSuggestions)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Try again later.";
        toast({ title: "Couldn't load suggestions", description: msg });
        setSuggestions([]);
      })
      .finally(() => setLoadingSuggestions(false));
  }, [step, image, style, suggestions, loadingSuggestions]);

  const saveImage = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `roomrevamp-${style}.png`;
    a.click();
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {step === "landing" && (
          <section className="max-w-xl w-full text-center space-y-8 animate-in fade-in duration-500">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary bg-primary-soft px-4 py-1.5 rounded-full">
              AI Room Stylist
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Don't know where to start? <span className="text-primary">Snap a pic</span>, pick a vibe, see your room reimagined.
            </h1>
            <p className="text-muted-foreground text-lg">
              Turn cluttered chaos into your dream space in seconds.
            </p>
            <Button size="lg" className="rounded-full px-8 h-14 text-base" onClick={() => setStep("upload")}>
              Get Started →
            </Button>
          </section>
        )}

        {step === "upload" && (
          <section className="max-w-xl w-full space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Upload your room</h2>
              <p className="text-muted-foreground">A messy photo is perfect — we love a challenge.</p>
            </div>

            <div
              {...getRootProps()}
              className={`bg-card rounded-3xl border-2 border-dashed p-8 cursor-pointer transition-colors shadow-card ${
                isDragActive ? "border-primary bg-primary-soft" : "border-border hover:border-primary"
              }`}
            >
              <input {...getInputProps()} capture="environment" />
              {image ? (
                <img src={image} alt="Your room" className="w-full aspect-[4/3] object-cover rounded-2xl" />
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold">Tap to take a photo or upload</p>
                    <p className="text-sm text-muted-foreground mt-1">Drag & drop also works on desktop</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 rounded-full h-12" onClick={() => setStep("landing")}>
                Back
              </Button>
              <Button
                className="flex-[2] rounded-full h-12"
                disabled={!image}
                onClick={() => setStep("style")}
              >
                Continue
              </Button>
            </div>
          </section>
        )}

        {step === "style" && (
          <section className="max-w-3xl w-full space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Pick your vibe</h2>
              <p className="text-muted-foreground">Which style speaks to you?</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => runGeneration(s.key)}
                  className="group bg-card rounded-3xl overflow-hidden text-left shadow-card hover:shadow-soft transition-all hover:-translate-y-1 border border-border"
                >
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={s.image}
                      alt={s.name}
                      width={512}
                      height={512}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-base sm:text-lg">{s.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button variant="ghost" className="w-full rounded-full h-12" onClick={() => setStep("upload")}>
              Back
            </Button>
          </section>
        )}

        {step === "loading" && (
          <section className="text-center space-y-8 animate-in fade-in duration-500">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-primary-soft" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Reorganizing your space...</h2>
              <p className="text-muted-foreground">Hold tight, magic in progress ✨</p>
            </div>
          </section>
        )}

        {step === "results" && image && result && (
          <section className="max-w-2xl w-full space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Voilà ✨</h2>
              <p className="text-muted-foreground">Same stuff, smarter layout.</p>
            </div>

            <Tabs defaultValue="reimagined" className="w-full">
              <TabsList className="grid grid-cols-2 w-full rounded-full h-12 p-1">
                <TabsTrigger value="reimagined" className="rounded-full h-10">
                  Reimagined
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="rounded-full h-10">
                  See my suggestions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reimagined" className="space-y-4 mt-4">
                <BeforeAfterSlider before={image} after={result} />
                <p className="text-xs text-center text-muted-foreground">
                  Reorganized using only items already in your photo — drag to compare.
                </p>
              </TabsContent>

              <TabsContent value="suggestions" className="mt-4">
                <div className="bg-card rounded-3xl border border-border shadow-card p-5 space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">New items that would fit</h3>
                    <p className="text-sm text-muted-foreground">
                      Pieces (not already in your room) to lean further into your {style} vibe.
                    </p>
                  </div>

                  {loadingSuggestions && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground py-6 justify-center">
                      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      Curating ideas for your space...
                    </div>
                  )}

                  {!loadingSuggestions && suggestions && suggestions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No suggestions right now. Try again in a moment.
                    </p>
                  )}

                  {!loadingSuggestions && suggestions && suggestions.length > 0 && (
                    <ul className="space-y-3">
                      {suggestions.map((s, i) => (
                        <li
                          key={i}
                          className="flex gap-3 p-3 rounded-2xl bg-primary-soft/40 border border-border"
                        >
                          <div className="w-8 h-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <h4 className="font-semibold text-sm sm:text-base">{s.name}</h4>
                              <span className="text-xs font-medium text-primary">{s.price_range}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-snug">{s.reason}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="secondary" className="rounded-full h-12" onClick={() => setStep("style")}>
                Try Another Style
              </Button>
              <Button className="rounded-full h-12" onClick={saveImage}>
                Save Image
              </Button>
              <Button variant="ghost" className="rounded-full h-12" onClick={reset}>
                Start Over
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default Index;

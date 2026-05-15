import { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ProductCard } from "@/components/ProductCard";
import {
  analyzeSpace,
  rearrangeSpace,
  suggestProducts,
  type SpaceAnalysis,
  type ProductSuggestion,
} from "@/lib/generateRoom";
import { toast } from "@/hooks/use-toast";
import { Camera, Sparkles, ArrowLeft, Download, RotateCcw, LayoutGrid, ShoppingBag, ChartBar as BarChart3, Loader as Loader2, CircleAlert as AlertCircle } from "lucide-react";

type Step = "landing" | "upload" | "analyzing" | "results" | "error";
type ErrorContext = "analyze" | "rearrange";
type AppError = { context: ErrorContext; message: string };

function friendlyError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (m.includes("payload") || m.includes("too large") || m.includes("body size") || m.includes("413")) {
    return "Your photo is too large to send. Try a smaller or lower-resolution image.";
  }
  if (m.includes("rate limit") || m.includes("429")) {
    return "We're being rate-limited right now. Please wait a moment and try again.";
  }
  if (m.includes("credits")) {
    return "AI credits have run out. Please try again later.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return "The request took too long. Please try again.";
  }
  return raw || "Something went wrong. Please try again.";
}

const Header = () => (
  <header className="w-full px-6 py-4 flex items-center gap-2.5">
    <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
      <LayoutGrid className="w-5 h-5 text-primary-foreground" />
    </div>
    <span className="font-bold text-lg tracking-tight">SpaceSort</span>
  </header>
);

const Index = () => {
  const [step, setStep] = useState<Step>("landing");
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SpaceAnalysis | null>(null);
  const [rearrangedImage, setRearrangedImage] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductSuggestion[] | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingRearrange, setLoadingRearrange] = useState(false);
  const [activeTab, setActiveTab] = useState("analysis");
  const [error, setError] = useState<AppError | null>(null);

  const processFile = async (file: File): Promise<string> => {
    let working: Blob = file;
    const isHeic =
      /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

    if (isHeic) {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
      working = Array.isArray(converted) ? converted[0] : converted;
    }

    // Downscale + re-encode as JPEG to keep edge-function payload small
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(working);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image"));
      el.src = dataUrl;
    });

    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".heic", ".heif"] },
    multiple: false,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;
      try {
        const processed = await processFile(file);
        setImage(processed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unsupported image format.";
        toast({ title: "Couldn't read that photo", description: msg });
      }
    },
  });

  const runAnalysis = useCallback(async (img: string) => {
    setStep("analyzing");
    setAnalysis(null);
    setRearrangedImage(null);
    setProducts(null);
    setError(null);

    try {
      const result = await analyzeSpace(img);
      setAnalysis(result);
      setStep("results");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      setError({ context: "analyze", message: friendlyError(msg) });
      setStep("error");
    }
  }, []);

  const runRearrange = useCallback(async () => {
    if (!image) return;
    setLoadingRearrange(true);
    setError(null);
    try {
      const result = await rearrangeSpace(image);
      setRearrangedImage(result.image);
      if (result.warning) {
        toast({ title: "Heads up", description: result.warning });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      setError({ context: "rearrange", message: friendlyError(msg) });
      setStep("error");
    } finally {
      setLoadingRearrange(false);
    }
  }, [image]);

  // Lazy-load products when the shop tab is activated
  useEffect(() => {
    if (activeTab !== "shop" || !image || products !== null || loadingProducts) return;
    setLoadingProducts(true);
    suggestProducts(image, analysis ?? undefined)
      .then(setProducts)
      .catch(() => {
        toast({ title: "Couldn't load products", description: "Try again later." });
        setProducts([]);
      })
      .finally(() => setLoadingProducts(false));
  }, [activeTab, image, analysis, products, loadingProducts]);

  const reset = () => {
    setImage(null);
    setAnalysis(null);
    setRearrangedImage(null);
    setProducts(null);
    setActiveTab("analysis");
    setStep("landing");
  };

  const saveImage = () => {
    if (!rearrangedImage) return;
    const a = document.createElement("a");
    a.href = rearrangedImage;
    a.download = "spacesort-rearranged.png";
    a.click();
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* LANDING */}
        {step === "landing" && (
          <section className="max-w-xl w-full text-center space-y-8 animate-in fade-in duration-500">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary bg-primary-soft px-4 py-1.5 rounded-full">
              AI Space Organizer
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
              Messy space? <span className="text-primary">Snap a pic</span>, see it organized.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Take a photo of any cluttered room, closet, or corner. AI analyzes the mess, shows you a
              rearranged version, and links to products that would help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="rounded-full px-8 h-14 text-base gap-2"
                onClick={() => setStep("upload")}
              >
                <Camera className="w-5 h-5" />
                Get Started
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 max-w-sm mx-auto">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center mx-auto">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-medium">Analyze</p>
              </div>
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-medium">Rearrange</p>
              </div>
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-medium">Shop</p>
              </div>
            </div>
          </section>
        )}

        {/* UPLOAD */}
        {step === "upload" && (
          <section className="max-w-xl w-full space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Upload your space</h2>
              <p className="text-muted-foreground">
                Any room, closet, garage, or corner that needs organizing.
              </p>
            </div>

            <div
              {...getRootProps()}
              className={`bg-card rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors shadow-card ${
                isDragActive ? "border-primary bg-primary-soft" : "border-border hover:border-primary"
              }`}
            >
              <input {...getInputProps()} capture="environment" />
              {image ? (
                <div className="relative">
                  <img
                    src={image}
                    alt="Your space"
                    className="w-full aspect-[4/3] object-cover rounded-lg"
                  />
                  <div className="absolute bottom-3 right-3">
                    <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-3 py-1">
                      Ready to analyze
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
                  <div className="w-16 h-16 rounded-xl bg-primary-soft flex items-center justify-center">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Tap to take a photo or upload</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Drag & drop also works on desktop
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 rounded-full h-12"
                onClick={() => setStep("landing")}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                className="flex-[2] rounded-full h-12 gap-2"
                disabled={!image}
                onClick={() => image && runAnalysis(image)}
              >
                <Sparkles className="w-4 h-4" />
                Analyze My Space
              </Button>
            </div>
          </section>
        )}

        {/* ANALYZING */}
        {step === "analyzing" && (
          <section className="text-center space-y-8 animate-in fade-in duration-500">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-primary-soft" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Analyzing your space...</h2>
              <p className="text-muted-foreground">
                Identifying clutter, organization issues, and rearrangement ideas
              </p>
            </div>
          </section>
        )}

        {/* RESULTS */}
        {step === "results" && image && analysis && (
          <section className="max-w-4xl w-full space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Your Space Analysis</h2>
              <p className="text-muted-foreground">
                {analysis.room_type.charAt(0).toUpperCase() + analysis.room_type.slice(1)} — Clutter level:{" "}
                <strong>{analysis.clutter_score}/10</strong> — Organization:{" "}
                <strong>{analysis.organization_score}/10</strong>
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 w-full rounded-full h-12 p-1">
                <TabsTrigger value="analysis" className="rounded-full h-10 text-sm">
                  <BarChart3 className="w-4 h-4 mr-1.5 hidden sm:inline" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger value="rearrange" className="rounded-full h-10 text-sm">
                  <Sparkles className="w-4 h-4 mr-1.5 hidden sm:inline" />
                  Rearrange
                </TabsTrigger>
                <TabsTrigger value="shop" className="rounded-full h-10 text-sm">
                  <ShoppingBag className="w-4 h-4 mr-1.5 hidden sm:inline" />
                  Shop
                </TabsTrigger>
              </TabsList>

              {/* ANALYSIS TAB */}
              <TabsContent value="analysis" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <img
                      src={image}
                      alt="Your space"
                      className="w-full aspect-[4/3] object-cover rounded-xl shadow-card"
                    />
                    <p className="text-xs text-center text-muted-foreground">Your original space</p>
                  </div>
                  <AnalysisPanel analysis={analysis} />
                </div>
              </TabsContent>

              {/* REARRANGE TAB */}
              <TabsContent value="rearrange" className="mt-4 space-y-4">
                {!rearrangedImage && !loadingRearrange && (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-xl bg-primary-soft flex items-center justify-center mx-auto">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">See your space reorganized</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        AI will rearrange your existing items into a cleaner, more functional layout — no
                        new items added.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="rounded-full px-8 h-14 gap-2"
                      onClick={runRearrange}
                    >
                      <Sparkles className="w-5 h-5" />
                      Generate Rearrangement
                    </Button>
                  </div>
                )}

                {loadingRearrange && (
                  <div className="text-center py-12 space-y-4">
                    <div className="relative w-20 h-20 mx-auto">
                      <div className="absolute inset-0 rounded-full border-4 border-primary-soft" />
                      <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">Rearranging your space...</h3>
                      <p className="text-sm text-muted-foreground">
                        Moving your items into a better layout
                      </p>
                    </div>
                  </div>
                )}

                {rearrangedImage && (
                  <div className="space-y-3">
                    <BeforeAfterSlider
                      before={image}
                      after={rearrangedImage}
                      beforeLabel="Original"
                      afterLabel="Reorganized"
                    />
                    <p className="text-xs text-center text-muted-foreground">
                      Same items, smarter layout — drag to compare
                    </p>
                    <div className="flex gap-3 justify-center pt-2">
                      <Button
                        variant="secondary"
                        className="rounded-full h-11 gap-2"
                        onClick={runRearrange}
                        disabled={loadingRearrange}
                      >
                        {loadingRearrange ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        Try Again
                      </Button>
                      <Button className="rounded-full h-11 gap-2" onClick={saveImage}>
                        <Download className="w-4 h-4" />
                        Save Image
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* SHOP TAB */}
              <TabsContent value="shop" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">Products to organize your space</h3>
                    <p className="text-sm text-muted-foreground">
                      Practical solutions based on what AI sees in your{" "}
                      {analysis.room_type}.
                    </p>
                  </div>

                  {loadingProducts && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      Finding the best products for your space...
                    </div>
                  )}

                  {!loadingProducts && products && products.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No product suggestions right now. Try again in a moment.
                    </p>
                  )}

                  {!loadingProducts && products && products.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {products.map((product, i) => (
                        <ProductCard key={i} product={product} />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-center pt-2">
              <Button variant="ghost" className="rounded-full h-12 gap-2" onClick={reset}>
                <RotateCcw className="w-4 h-4" />
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

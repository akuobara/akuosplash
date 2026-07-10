"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, MapPin, Check } from "lucide-react";
import { toast } from "sonner";

interface MapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lat: number, lng: number, displayName: string) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
}

export function MapPicker({ open, onOpenChange, onSelect, initialLat, initialLng }: MapPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [previewLat, setPreviewLat] = useState<number | null>(initialLat);
  const [previewLng, setPreviewLng] = useState<number | null>(initialLng);

  useEffect(() => {
    if (open) {
      setPreviewLat(initialLat ?? null);
      setPreviewLng(initialLng ?? null);
      setSelected(null);
      setResults([]);
      setQuery("");
    }
  }, [open, initialLat, initialLng]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=cl`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();
      if (data.length === 0) {
        toast.error("No se encontraron resultados. Prueba con otra dirección.");
        setSearching(false);
        return;
      }
      setResults(data);
    } catch {
      toast.error("No se pudo buscar la dirección. Verifica tu conexión.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: SearchResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setSelected(r);
    setPreviewLat(lat);
    setPreviewLng(lng);
  }

  function confirm() {
    if (previewLat != null && previewLng != null) {
      onSelect(previewLat, previewLng, selected?.display_name || "");
      onOpenChange(false);
    }
  }

  // URL para embed de OpenStreetMap con marcador
  const mapUrl =
    previewLat != null && previewLng != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${previewLng - 0.01},${previewLat - 0.01},${previewLng + 0.01},${previewLat + 0.01}&layer=mapnik&marker=${previewLat},${previewLng}`
      : `https://www.openstreetmap.org/export/embed.html?bbox=-70.7,-33.5,-70.6,-33.4&layer=mapnik`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar ubicación del cliente</DialogTitle>
          <DialogDescription>
            Busca por dirección, nombre del lugar, o calle. Selecciona el resultado correcto en el mapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Buscador */}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
              placeholder="Ej. Los Aromos 123, Maipú, Santiago"
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {/* Resultados de búsqueda */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto rounded-lg border border-border">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r)}
                  className={`flex w-full items-start gap-2 p-2 text-left text-sm hover:bg-muted/40 ${
                    selected?.display_name === r.display_name ? "bg-primary/10" : ""
                  }`}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="line-clamp-2">{r.display_name}</span>
                  {selected?.display_name === r.display_name && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Mapa */}
          <div className="overflow-hidden rounded-lg border border-border">
            <iframe
              src={mapUrl}
              className="h-64 w-full"
              title="Mapa de ubicación"
              style={{ border: 0 }}
            />
          </div>

          {previewLat != null && previewLng != null && (
            <div className="rounded-lg bg-muted/40 p-2 text-center text-xs text-muted-foreground">
              Ubicación seleccionada: <strong>{previewLat.toFixed(5)}, {previewLng.toFixed(5)}</strong>
              <br />
              <a
                href={`https://www.google.com/maps?q=${previewLat},${previewLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Ver en Google Maps
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={previewLat == null}>
            <Check className="mr-1 h-4 w-4" /> Confirmar ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CopyPlus,
  EyeOff,
  Hand,
  ImagePlus,
  Lightbulb,
  Monitor,
  MousePointer2,
  PencilLine,
  Plus,
  Redo2,
  RotateCcw,
  Smartphone,
  Square,
  Tablet,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Editor visual do Clonador: selecione qualquer elemento do site e edite, mova, duplique ou apague.
 * O site roda num iframe sem scripts (seguro); o editor controla a página por fora.
 */

export type VisualEditorHandle = { getHtml: () => string };

const STYLE_ID = "__fab_editor_style";
const HOVER = "__fab-hov";
const SELECTED = "__fab-sel";
const EDITOR_CSS = `
  .${HOVER} { outline: 1px dashed rgba(56,170,255,.8) !important; outline-offset: 1px !important; }
  .${SELECTED} { outline: 2px solid #38aaff !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px rgba(56,170,255,.18) !important; }
  [contenteditable="true"] { outline: 2px solid #f5c24b !important; cursor: text !important; }
  a, button { cursor: default !important; }
  /* Elementos que só aparecem com animação ao rolar (os scripts ficam parados na edição):
     mostra todos para dar para editar. Isso só vale dentro do editor, não vai para o site. */
  [data-aos], .aos-init, .wow, [data-sal], [data-scroll], [data-scroll-reveal], .reveal, .sr,
  [data-animate], [data-animation], .animate__animated, .elementor-invisible, [data-w-id],
  [data-framer-appear-id], [data-motion], .fade-in, .fade-up, .js-reveal, [style*="opacity:0"], [style*="opacity: 0"] {
    opacity: 1 !important; visibility: visible !important; transform: none !important;
    animation: none !important; transition: none !important; clip-path: none !important;
  }
`;

type Snapshot = { body: string; bodyStyle: string | null };
type Tool = "selecionar" | "mover";
type Viewport = "pc" | "tablet" | "celular";

const VIEWPORT_WIDTH: Record<Viewport, string> = { pc: "100%", tablet: "768px", celular: "390px" };

function rgbToHex(value: string): string {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m?.[1]) return value.startsWith("#") ? value.slice(0, 7) : "#000000";
  const [r = 0, g = 0, b = 0, a] = m[1].split(",").map((v) => parseFloat(v));
  if (a === 0) return "#ffffff";
  return "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
}

function describe(el: Element) {
  const id = el.id ? `#${el.id}` : "";
  const cls = [...el.classList].filter((c) => !c.startsWith("__fab")).slice(0, 2);
  return `${el.tagName.toLowerCase()}${id}${cls.length ? "." + cls.join(".") : ""}`;
}

const SNIPPETS: Record<string, { label: string; html: string }> = {
  titulo: {
    label: "Título",
    html: '<h2 style="font-size:36px;font-weight:700;margin:24px 0;">Seu título aqui</h2>',
  },
  texto: {
    label: "Texto",
    html: '<p style="font-size:18px;line-height:1.6;margin:12px 0;">Escreva seu texto aqui.</p>',
  },
  botao: {
    label: "Botão",
    html: '<a href="#" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;">Chamar no WhatsApp</a>',
  },
  imagem: {
    label: "Imagem",
    html: '<img src="https://placehold.co/800x450?text=Sua+imagem" alt="" style="max-width:100%;height:auto;border-radius:12px;display:block;margin:16px auto;">',
  },
  secao: {
    label: "Seção",
    html: '<section style="padding:64px 24px;text-align:center;background:#f5f5f5;"><h2 style="font-size:32px;margin:0 0 12px;">Nova seção</h2><p style="font-size:18px;margin:0;">Descreva aqui.</p></section>',
  },
};

export const VisualEditor = forwardRef<VisualEditorHandle, { html: string }>(function VisualEditor(
  { html },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const docRef = useRef<Document | null>(null);
  const selectedRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef<HTMLElement | null>(null);
  const editingRef = useRef<HTMLElement | null>(null);
  const toolRef = useRef<Tool>("selecionar");
  const undoRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetRef = useRef<HTMLImageElement | null>(null);

  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [tool, setToolState] = useState<Tool>("selecionar");
  const [viewport, setViewport] = useState<Viewport>("pc");
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const [mostrarDicas, setMostrarDicas] = useState(() => {
    try {
      return localStorage.getItem("fabrica:dicas-editor") !== "ok";
    } catch {
      return true;
    }
  });
  const fecharDicas = () => {
    setMostrarDicas(false);
    try {
      localStorage.setItem("fabrica:dicas-editor", "ok");
    } catch {
      /* sem armazenamento */
    }
  };

  // Fecha as dicas sozinho no primeiro toque em algum elemento.
  useEffect(() => {
    if (selected && mostrarDicas) fecharDicas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const setTool = (t: Tool) => {
    toolRef.current = t;
    setToolState(t);
  };

  /** Copia do corpo da página sem as marcações do editor. */
  const snapshot = useCallback((): Snapshot | null => {
    const doc = docRef.current;
    if (!doc?.body) return null;
    const clone = doc.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(`.${HOVER}, .${SELECTED}`).forEach((el) => {
      el.classList.remove(HOVER, SELECTED);
      if (!el.getAttribute("class")) el.removeAttribute("class");
    });
    clone
      .querySelectorAll("[contenteditable]")
      .forEach((el) => el.removeAttribute("contenteditable"));
    return { body: clone.innerHTML, bodyStyle: doc.body.getAttribute("style") };
  }, []);

  /** Guarda o estado atual antes de uma mudança, para poder desfazer. */
  const pushHistory = useCallback(() => {
    const snap = snapshot();
    if (!snap) return;
    const last = undoRef.current.at(-1);
    if (last && last.body === snap.body && last.bodyStyle === snap.bodyStyle) return;
    undoRef.current.push(snap);
    if (undoRef.current.length > 60) undoRef.current.shift();
    redoRef.current = [];
  }, [snapshot]);

  const select = useCallback(
    (el: HTMLElement | null) => {
      selectedRef.current?.classList.remove(SELECTED);
      if (el && (el.tagName === "HTML" || el.tagName === "HEAD")) el = docRef.current?.body ?? null;
      selectedRef.current = el;
      el?.classList.add(SELECTED);
      setSelected(el);
      refresh();
    },
    [refresh],
  );

  const stopTextEdit = useCallback(() => {
    const el = editingRef.current;
    if (!el) return;
    el.removeAttribute("contenteditable");
    editingRef.current = null;
    refresh();
  }, [refresh]);

  const startTextEdit = useCallback(
    (el: HTMLElement) => {
      stopTextEdit();
      pushHistory();
      el.setAttribute("contenteditable", "true");
      editingRef.current = el;
      el.focus();
      refresh();
    },
    [pushHistory, refresh, stopTextEdit],
  );

  const restore = useCallback(
    (snap: Snapshot) => {
      const doc = docRef.current;
      if (!doc?.body) return;
      doc.body.innerHTML = snap.body;
      if (snap.bodyStyle === null) doc.body.removeAttribute("style");
      else doc.body.setAttribute("style", snap.bodyStyle);
      editingRef.current = null;
      select(null);
    },
    [select],
  );

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    const cur = snapshot();
    if (!prev || !cur) return;
    redoRef.current.push(cur);
    restore(prev);
  }, [restore, snapshot]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    const cur = snapshot();
    if (!next || !cur) return;
    undoRef.current.push(cur);
    restore(next);
  }, [restore, snapshot]);

  // ===== Ações sobre o elemento selecionado =====
  const act = (fn: (el: HTMLElement) => void) => {
    const el = selectedRef.current;
    if (!el) return;
    pushHistory();
    fn(el);
    refresh();
  };

  const remove = useCallback(() => {
    const el = selectedRef.current;
    if (!el || el.tagName === "BODY") return;
    pushHistory();
    const next = (el.nextElementSibling ||
      el.previousElementSibling ||
      el.parentElement) as HTMLElement | null;
    el.remove();
    select(next && next.tagName !== "HTML" ? next : null);
  }, [pushHistory, select]);

  const duplicate = useCallback(() => {
    const el = selectedRef.current;
    if (!el || el.tagName === "BODY") return;
    pushHistory();
    const copy = el.cloneNode(true) as HTMLElement;
    copy.classList.remove(SELECTED, HOVER);
    el.after(copy);
    select(copy);
  }, [pushHistory, select]);

  const moveUp = () =>
    act((el) => {
      const prev = el.previousElementSibling;
      if (prev) prev.before(el);
    });
  const moveDown = () =>
    act((el) => {
      const next = el.nextElementSibling;
      if (next) next.after(el);
    });

  const setStyle = (prop: string, value: string) => {
    const el = selectedRef.current;
    if (!el) return;
    if (value === "") el.style.removeProperty(prop);
    else el.style.setProperty(prop, value, "important");
    refresh();
  };

  const insertAfter = (snippetHtml: string) => {
    const doc = docRef.current;
    if (!doc) return;
    pushHistory();
    const tpl = doc.createElement("template");
    tpl.innerHTML = snippetHtml.trim();
    const node = tpl.content.firstElementChild as HTMLElement | null;
    if (!node) return;
    const anchor = selectedRef.current;
    if (anchor && anchor.tagName !== "BODY") anchor.after(node);
    else doc.body.appendChild(node);
    select(node);
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const pickImage = (img: HTMLImageElement) => {
    imageTargetRef.current = img;
    imageInputRef.current?.click();
  };

  const onImageFile = (file: File | undefined) => {
    const img = imageTargetRef.current;
    if (!file || !img) return;
    const reader = new FileReader();
    reader.onload = () => {
      pushHistory();
      img.src = String(reader.result);
      img.removeAttribute("srcset");
      img
        .closest("picture")
        ?.querySelectorAll("source")
        .forEach((s) => s.remove());
      refresh();
      toast.success("Imagem trocada.");
    };
    reader.readAsDataURL(file);
  };

  // ===== Ligação com o iframe =====
  const onLoad = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    docRef.current = doc;
    undoRef.current = [];
    redoRef.current = [];
    selectedRef.current = null;
    setSelected(null);

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = EDITOR_CSS;
    (doc.head || doc.documentElement).appendChild(style);

    let drag: {
      el: HTMLElement;
      x: number;
      y: number;
      tx: number;
      ty: number;
      moved: boolean;
    } | null = null;

    doc.addEventListener("mouseover", (e) => {
      const t = e.target as HTMLElement;
      if (t === hoverRef.current || t.tagName === "HTML") return;
      hoverRef.current?.classList.remove(HOVER);
      hoverRef.current = t;
      t.classList.add(HOVER);
    });
    doc.addEventListener("mouseleave", () => {
      hoverRef.current?.classList.remove(HOVER);
      hoverRef.current = null;
    });

    doc.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        if (editingRef.current?.contains(t)) return; // clique dentro do texto em edição
        e.preventDefault();
        e.stopPropagation();
        stopTextEdit();
        if (drag?.moved) return;
        select(t);
      },
      true,
    );

    doc.addEventListener("dblclick", (e) => {
      const t = e.target as HTMLElement;
      e.preventDefault();
      if (t.tagName === "IMG") pickImage(t as HTMLImageElement);
      else if (t.tagName !== "BODY") startTextEdit(t);
    });

    doc.addEventListener("submit", (e) => e.preventDefault(), true);

    doc.addEventListener("pointerdown", (e) => {
      if (toolRef.current !== "mover") return;
      const sel = selectedRef.current;
      const t = e.target as HTMLElement;
      const el = sel && sel.contains(t) ? sel : t;
      if (!el || el.tagName === "BODY") return;
      e.preventDefault();
      if (el !== sel) select(el);
      const cur = el.style.translate.split(" ").map((v) => parseFloat(v) || 0);
      pushHistory();
      drag = { el, x: e.clientX, y: e.clientY, tx: cur[0] ?? 0, ty: cur[1] ?? 0, moved: false };
      if (doc.defaultView?.getComputedStyle(el).position === "static")
        el.style.position = "relative";
      el.style.zIndex = el.style.zIndex || "5";
    });
    doc.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      drag.el.style.translate = `${Math.round(drag.tx + dx)}px ${Math.round(drag.ty + dy)}px`;
    });
    const endDrag = () => {
      if (!drag) return;
      const wasMoved = drag.moved;
      setTimeout(() => {
        drag = null;
      }, 0);
      if (!wasMoved) undoRef.current.pop();
      refresh();
    };
    doc.addEventListener("pointerup", endDrag);
    doc.addEventListener("pointercancel", endDrag);

    doc.addEventListener("keydown", (e) => handleKey(e));

    // A barrinha flutuante acompanha a rolagem do site.
    let agendado = false;
    const acompanhar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => {
        agendado = false;
        if (selectedRef.current) refresh();
      });
    };
    doc.addEventListener("scroll", acompanhar, true);
    doc.defaultView?.addEventListener("resize", acompanhar);
  };

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (editingRef.current) {
        if (e.key === "Escape") stopTextEdit();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if (e.key === "Escape") {
        select(null);
      }
    },
    [duplicate, redo, remove, select, stopTextEdit, undo],
  );

  // Atalhos também quando o foco está fora do iframe (no painel).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (!selectedRef.current && !(e.ctrlKey || e.metaKey)) return;
      handleKey(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey]);

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => {
        const doc = docRef.current;
        if (!doc?.documentElement) return html;
        const clone = doc.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelector(`#${STYLE_ID}`)?.remove();
        clone.querySelectorAll(`.${HOVER}, .${SELECTED}`).forEach((el) => {
          el.classList.remove(HOVER, SELECTED);
          if (!el.getAttribute("class")) el.removeAttribute("class");
        });
        clone
          .querySelectorAll("[contenteditable]")
          .forEach((el) => el.removeAttribute("contenteditable"));
        return "<!DOCTYPE html>\n" + clone.outerHTML;
      },
    }),
    [html],
  );

  const el = selected;
  const cs =
    el && docRef.current?.defaultView ? docRef.current.defaultView.getComputedStyle(el) : null;
  const isImg = el?.tagName === "IMG";
  const link = el?.closest("a") as HTMLAnchorElement | null;
  const editingText = !!editingRef.current;
  const soTexto = !!el && !isImg && el.tagName !== "BODY" && el.children.length === 0;

  // Posição da barrinha flutuante sobre o elemento selecionado.
  let barra: { top: number; left: number } | null = null;
  if (el && el.tagName !== "BODY" && frameRef.current && el.isConnected) {
    const f = frameRef.current;
    const r = el.getBoundingClientRect();
    const larguraBarra = 330;
    const visivel = r.bottom > 0 && r.top < f.clientHeight;
    if (visivel) {
      const top =
        r.top > 46
          ? f.offsetTop + r.top - 42
          : f.offsetTop + Math.min(r.bottom + 6, f.clientHeight - 40);
      const left = f.offsetLeft + Math.max(4, Math.min(r.left, f.clientWidth - larguraBarra - 4));
      barra = { top, left };
    }
  }

  const caminho: HTMLElement[] = [];
  for (let n: HTMLElement | null = el; n && n.tagName !== "HTML"; n = n.parentElement)
    caminho.unshift(n);

  return (
    <div className="flex flex-col lg:flex-row">
      {/* Área do site */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 border-b border-primary/20 bg-background/60 p-2">
          <Segmento>
            <ToolButton
              active={tool === "selecionar"}
              onClick={() => setTool("selecionar")}
              title="Selecionar e editar"
            >
              <MousePointer2 className="size-4" />{" "}
              <span className="hidden sm:inline">Selecionar</span>
            </ToolButton>
            <ToolButton
              active={tool === "mover"}
              onClick={() => setTool("mover")}
              title="Arrastar elementos livremente"
            >
              <Hand className="size-4" /> <span className="hidden sm:inline">Mover</span>
            </ToolButton>
          </Segmento>
          <Segmento>
            <ToolButton onClick={undo} title="Desfazer (Ctrl+Z)" disabled={!undoRef.current.length}>
              <Undo2 className="size-4" />
            </ToolButton>
            <ToolButton onClick={redo} title="Refazer (Ctrl+Y)" disabled={!redoRef.current.length}>
              <Redo2 className="size-4" />
            </ToolButton>
          </Segmento>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
              >
                <Plus className="size-4" /> Adicionar
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 border-primary/30 p-3">
              <InsertBlock onInsert={insertAfter} after={!!el && el.tagName !== "BODY"} />
            </PopoverContent>
          </Popover>
          <Segmento className="ml-auto">
            <ToolButton
              active={viewport === "pc"}
              onClick={() => setViewport("pc")}
              title="Ver como PC"
            >
              <Monitor className="size-4" />
            </ToolButton>
            <ToolButton
              active={viewport === "tablet"}
              onClick={() => setViewport("tablet")}
              title="Ver como tablet"
            >
              <Tablet className="size-4" />
            </ToolButton>
            <ToolButton
              active={viewport === "celular"}
              onClick={() => setViewport("celular")}
              title="Ver como celular"
            >
              <Smartphone className="size-4" />
            </ToolButton>
          </Segmento>
        </div>

        {/* Caminho clicável até o elemento */}
        <div className="flex min-h-9 items-center gap-1 overflow-x-auto border-b border-primary/10 bg-background/40 px-2 py-1 text-[11px] whitespace-nowrap">
          {el ? (
            caminho.slice(-5).map((n, i, arr) => (
              <span key={i} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => select(n)}
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 transition-colors hover:bg-primary/15",
                    i === arr.length - 1
                      ? "bg-primary/20 font-semibold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {nomeAmigavel(n)}
                </button>
                {i < arr.length - 1 && <ChevronRight className="size-3 text-muted-foreground/60" />}
              </span>
            ))
          ) : (
            <span className="px-1.5 text-muted-foreground">
              {tool === "mover"
                ? "Arraste qualquer parte do site para mudar de lugar"
                : "Toque em qualquer parte do site para começar"}
            </span>
          )}
        </div>

        <div className="relative flex justify-center bg-background/80">
          {mostrarDicas && (
            <div className="absolute inset-x-2 top-2 z-20 flex items-start gap-3 rounded-sm border border-primary/40 bg-background/95 p-3 text-xs shadow-xl backdrop-blur">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" />
              <ol className="grid flex-1 gap-1.5 sm:grid-cols-3">
                <li>
                  <b className="text-primary">1.</b> Toque em qualquer parte do site.
                </li>
                <li>
                  <b className="text-primary">2.</b> Use a barrinha que aparece em cima dela.
                </li>
                <li>
                  <b className="text-primary">3.</b> Ajuste cores e tamanhos no painel ao lado.
                </li>
              </ol>
              <button
                type="button"
                onClick={fecharDicas}
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label="Fechar dicas"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <iframe
            ref={frameRef}
            title="Editor visual do site"
            srcDoc={html}
            sandbox="allow-same-origin"
            onLoad={onLoad}
            style={{ width: VIEWPORT_WIDTH[viewport] }}
            className="block h-[70dvh] max-w-full bg-white transition-[width] duration-300"
          />

          {/* Barrinha flutuante */}
          {barra && el && (
            <div
              className="absolute z-10 flex items-center gap-0.5 rounded-sm border border-primary/60 bg-background/95 p-0.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,.8),0_0_14px_-4px_var(--color-primary)] backdrop-blur"
              style={{ top: barra.top, left: barra.left }}
            >
              <span className="px-2 font-mono text-[10px] text-primary uppercase">
                {nomeAmigavel(el)}
              </span>
              <BarraBtn
                onClick={() =>
                  isImg
                    ? pickImage(el as HTMLImageElement)
                    : editingText
                      ? stopTextEdit()
                      : startTextEdit(el)
                }
                title={isImg ? "Trocar imagem" : editingText ? "Terminar edição" : "Editar texto"}
                destaque={editingText}
              >
                {isImg ? (
                  <ImagePlus className="size-4" />
                ) : editingText ? (
                  <Check className="size-4" />
                ) : (
                  <PencilLine className="size-4" />
                )}
              </BarraBtn>
              <BarraBtn onClick={moveUp} title="Subir">
                <ArrowUp className="size-4" />
              </BarraBtn>
              <BarraBtn onClick={moveDown} title="Descer">
                <ArrowDown className="size-4" />
              </BarraBtn>
              <BarraBtn onClick={duplicate} title="Duplicar (Ctrl+D)">
                <CopyPlus className="size-4" />
              </BarraBtn>
              <BarraBtn
                onClick={() =>
                  el.parentElement &&
                  el.parentElement.tagName !== "HTML" &&
                  select(el.parentElement)
                }
                title="Selecionar o bloco de fora"
              >
                <ChevronsUpDown className="size-4" />
              </BarraBtn>
              <BarraBtn onClick={remove} title="Apagar (Delete)" perigo>
                <Trash2 className="size-4" />
              </BarraBtn>
            </div>
          )}
        </div>
      </div>

      {/* Painel de propriedades */}
      <aside className="max-h-[calc(70dvh+80px)] w-full shrink-0 overflow-y-auto border-t border-primary/20 bg-background/70 lg:w-80 lg:border-t-0 lg:border-l">
        {!el ? (
          <div className="space-y-4 p-4">
            <p className="sys-label">[ Editor ]</p>
            <p className="text-sm text-muted-foreground">
              Toque em qualquer parte do site para editar. Dois toques num texto escrevem por cima;
              numa imagem, trocam a foto.
            </p>
            <ul className="space-y-1.5 rounded-sm border border-primary/15 bg-background/40 p-3 font-mono text-[11px] text-muted-foreground">
              <li>Delete · apagar</li>
              <li>Ctrl+D · duplicar</li>
              <li>Ctrl+Z / Ctrl+Y · desfazer / refazer</li>
              <li>Esc · soltar a seleção</li>
            </ul>
            <p className="text-[11px] text-muted-foreground">
              As animações ficam paradas enquanto você edita. Veja tudo se mexendo na aba <b>Ver</b>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
                {isImg ? (
                  <ImagePlus className="size-4" />
                ) : soTexto ? (
                  <Type className="size-4" />
                ) : (
                  <Square className="size-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{nomeAmigavel(el)}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {describe(el)}
                </p>
              </div>
            </div>

            <Tabs
              defaultValue={isImg || soTexto || link ? "conteudo" : "estilo"}
              key={describe(el) + (isImg ? "i" : "")}
            >
              <TabsList className="grid h-auto w-full grid-cols-4 bg-secondary/60">
                <TabsTrigger value="conteudo" className="px-1 text-[11px]">
                  Conteúdo
                </TabsTrigger>
                <TabsTrigger value="estilo" className="px-1 text-[11px]">
                  Estilo
                </TabsTrigger>
                <TabsTrigger value="layout" className="px-1 text-[11px]">
                  Layout
                </TabsTrigger>
                <TabsTrigger value="codigo" className="px-1 text-[11px]">
                  Código
                </TabsTrigger>
              </TabsList>

              <TabsContent value="conteudo" className="mt-4 space-y-4">
                {soTexto && (
                  <Field label="Texto">
                    <CommitTextarea
                      value={el.textContent || ""}
                      onCommit={(v) => act((x) => (x.textContent = v))}
                    />
                  </Field>
                )}
                {isImg && (
                  <>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => pickImage(el as HTMLImageElement)}
                    >
                      <ImagePlus className="size-4" /> Trocar por uma foto sua
                    </Button>
                    <Field label="Ou cole o endereço de uma imagem">
                      <CommitInput
                        value={(el as HTMLImageElement).getAttribute("src") || ""}
                        onCommit={(v) => act((x) => (x as HTMLImageElement).setAttribute("src", v))}
                      />
                    </Field>
                    <Field label="Descrição da imagem (ajuda no Google)">
                      <CommitInput
                        value={(el as HTMLImageElement).alt}
                        onCommit={(v) => act((x) => ((x as HTMLImageElement).alt = v))}
                      />
                    </Field>
                    <Field label="Encaixe">
                      <Segmented
                        value={cs?.objectFit || "fill"}
                        options={[
                          ["cover", "Preencher"],
                          ["contain", "Inteira"],
                          ["fill", "Esticar"],
                        ]}
                        onChange={(v) => act(() => setStyle("object-fit", v))}
                      />
                    </Field>
                  </>
                )}
                {link && (
                  <>
                    <Field label="Quando clicar, leva para">
                      <CommitInput
                        value={link.getAttribute("href") || ""}
                        placeholder="https://wa.me/5562999999999"
                        onCommit={(v) => {
                          pushHistory();
                          link.setAttribute("href", v);
                          refresh();
                        }}
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={link.target === "_blank"}
                        onChange={(e) => {
                          pushHistory();
                          if (e.target.checked) {
                            link.target = "_blank";
                            link.rel = "noopener";
                          } else link.removeAttribute("target");
                          refresh();
                        }}
                      />
                      Abrir em nova aba
                    </label>
                  </>
                )}
                {!soTexto && !isImg && !link && (
                  <p className="text-xs text-muted-foreground">
                    Este é um bloco com outras coisas dentro. Toque direto no texto ou na imagem que
                    quer mudar, ou use as abas Estilo e Layout para mexer no bloco inteiro.
                  </p>
                )}
                {!soTexto && !isImg && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => (editingText ? stopTextEdit() : startTextEdit(el))}
                  >
                    <PencilLine className="size-4" />{" "}
                    {editingText ? "Terminar edição" : "Escrever direto no site"}
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="estilo" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Cor do texto">
                    <ColorInput
                      value={rgbToHex(cs?.color || "#000")}
                      onStart={pushHistory}
                      onChange={(v) => setStyle("color", v)}
                    />
                  </Field>
                  <Field label="Cor de fundo">
                    <ColorInput
                      value={rgbToHex(cs?.backgroundColor || "#fff")}
                      onStart={pushHistory}
                      onChange={(v) => setStyle("background-color", v)}
                    />
                  </Field>
                </div>
                <Field
                  label={`Tamanho da letra · ${Math.round(parseFloat(cs?.fontSize || "16"))}px`}
                >
                  <Slider
                    value={[parseFloat(cs?.fontSize || "16")]}
                    min={8}
                    max={120}
                    step={1}
                    onPointerDown={pushHistory}
                    onValueChange={([v]) => setStyle("font-size", `${v ?? 16}px`)}
                  />
                </Field>
                <Field label="Peso da letra">
                  <Segmented
                    value={String(cs?.fontWeight || "400")}
                    options={[
                      ["300", "Fino"],
                      ["400", "Normal"],
                      ["600", "Médio"],
                      ["800", "Forte"],
                    ]}
                    onChange={(v) => act(() => setStyle("font-weight", v))}
                  />
                </Field>
                <Field label="Alinhamento">
                  <div className="flex gap-1">
                    {(
                      [
                        ["left", AlignLeft],
                        ["center", AlignCenter],
                        ["right", AlignRight],
                      ] as const
                    ).map(([v, Icon]) => (
                      <SmallButton
                        key={v}
                        className="flex-1"
                        active={cs?.textAlign === v || (v === "left" && cs?.textAlign === "start")}
                        onClick={() => act(() => setStyle("text-align", v))}
                      >
                        <Icon className="size-3.5" />
                      </SmallButton>
                    ))}
                  </div>
                </Field>
                <Field
                  label={`Cantos arredondados · ${Math.round(parseFloat(cs?.borderTopLeftRadius || "0"))}px`}
                >
                  <Slider
                    value={[parseFloat(cs?.borderTopLeftRadius || "0")]}
                    min={0}
                    max={60}
                    step={1}
                    onPointerDown={pushHistory}
                    onValueChange={([v]) => setStyle("border-radius", `${v ?? 0}px`)}
                  />
                </Field>
                <Field
                  label={`Transparência · ${Math.round(parseFloat(cs?.opacity || "1") * 100)}%`}
                >
                  <Slider
                    value={[parseFloat(cs?.opacity || "1") * 100]}
                    min={0}
                    max={100}
                    step={5}
                    onPointerDown={pushHistory}
                    onValueChange={([v]) => setStyle("opacity", String((v ?? 100) / 100))}
                  />
                </Field>
                <Field label="Fonte">
                  <CommitInput
                    value={cs?.fontFamily || ""}
                    onCommit={(v) => act(() => setStyle("font-family", v))}
                  />
                </Field>
              </TabsContent>

              <TabsContent value="layout" className="mt-4 space-y-4">
                <Field
                  label={`Espaço por dentro · ${Math.round(parseFloat(cs?.paddingTop || "0"))}px`}
                >
                  <Slider
                    value={[parseFloat(cs?.paddingTop || "0")]}
                    min={0}
                    max={160}
                    step={2}
                    onPointerDown={pushHistory}
                    onValueChange={([v]) => setStyle("padding", `${v ?? 0}px`)}
                  />
                </Field>
                <Field
                  label={`Espaço por fora · ${Math.round(parseFloat(cs?.marginTop || "0"))}px`}
                >
                  <Slider
                    value={[parseFloat(cs?.marginTop || "0")]}
                    min={0}
                    max={160}
                    step={2}
                    onPointerDown={pushHistory}
                    onValueChange={([v]) => setStyle("margin-top", `${v ?? 0}px`)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Largura">
                    <CommitInput
                      value={el.style.width || cs?.width || ""}
                      onCommit={(v) => act(() => setStyle("width", /^\d+$/.test(v) ? `${v}px` : v))}
                    />
                  </Field>
                  <Field label="Altura">
                    <CommitInput
                      value={el.style.height || cs?.height || ""}
                      onCommit={(v) =>
                        act(() => setStyle("height", /^\d+$/.test(v) ? `${v}px` : v))
                      }
                    />
                  </Field>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Largura e altura aceitam px, %, auto. Ex.: 100%, 320px.
                </p>
                <div className="grid grid-cols-2 gap-1">
                  <SmallButton
                    onClick={() => act((x) => x.style.setProperty("display", "none", "important"))}
                  >
                    <EyeOff className="size-3.5" /> Ocultar
                  </SmallButton>
                  <SmallButton
                    onClick={() =>
                      act((x) => {
                        x.style.removeProperty("translate");
                      })
                    }
                  >
                    <RotateCcw className="size-3.5" /> Posição original
                  </SmallButton>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Para arrastar livremente, use <b>Mover</b> na barra de cima.
                </p>
              </TabsContent>

              <TabsContent value="codigo" className="mt-4 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Para quem entende de HTML: edite o código só deste pedaço.
                </p>
                <OuterHtmlEditor
                  key={el.outerHTML.length + describe(el)}
                  el={el}
                  onApply={(code) => {
                    const doc = docRef.current;
                    if (!doc) return;
                    pushHistory();
                    const tpl = doc.createElement("template");
                    tpl.innerHTML = code.trim();
                    const nodes = [...tpl.content.childNodes];
                    if (!nodes.length) return;
                    el.replaceWith(...nodes);
                    select((nodes.find((n) => n.nodeType === 1) as HTMLElement) ?? null);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </aside>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onImageFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
});

/** Nome que qualquer pessoa entende para cada tipo de elemento. */
function nomeAmigavel(el: Element): string {
  const t = el.tagName;
  if (t === "BODY") return "Página";
  if (t === "IMG" || t === "PICTURE") return "Imagem";
  if (t === "H1" || t === "H2" || t === "H3") return "Título";
  if (/^H[4-6]$/.test(t)) return "Subtítulo";
  if (t === "A") return el.children.length ? "Link" : "Botão / link";
  if (t === "BUTTON") return "Botão";
  if (t === "HEADER") return "Topo";
  if (t === "FOOTER") return "Rodapé";
  if (t === "NAV") return "Menu";
  if (t === "SECTION" || t === "MAIN" || t === "ARTICLE") return "Seção";
  if (t === "VIDEO") return "Vídeo";
  if (t === "CANVAS") return "Animação / 3D";
  if (t === "SVG" || t === "svg") return "Ícone";
  if (t === "FORM") return "Formulário";
  if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return "Campo";
  if (t === "UL" || t === "OL") return "Lista";
  if (t === "LI") return "Item";
  if (t === "P" || t === "SPAN" || t === "LABEL" || t === "STRONG" || t === "EM" || t === "SMALL")
    return "Texto";
  if (t === "IFRAME") return "Conteúdo incorporado";
  return el.children.length ? "Bloco" : "Texto";
}

// ===== Peças do painel =====

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="sys-label text-[10px]">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToolButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:opacity-35",
        active &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SmallButton({
  onClick,
  children,
  active,
  danger,
  title,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  danger?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-secondary/60 px-2 py-1 text-[11px] transition-colors hover:border-primary/50",
        active && "border-primary bg-primary/20 text-primary",
        danger && "hover:border-destructive hover:text-destructive",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Campo de texto que só aplica ao apertar Enter ou sair do campo. */
function CommitInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft.trim());
  };
  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className="h-8 px-2 font-mono text-xs"
    />
  );
}

function ColorInput({
  value,
  onStart,
  onChange,
}: {
  value: string;
  onStart: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-input px-1.5">
      <input
        type="color"
        value={value}
        onFocus={onStart}
        onPointerDown={onStart}
        onChange={(e) => onChange(e.target.value)}
        className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <span className="font-mono text-[11px] text-muted-foreground">{value}</span>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map(([v, label]) => (
        <SmallButton key={v} active={value === v} onClick={() => onChange(v)} className="flex-1">
          {label}
        </SmallButton>
      ))}
    </div>
  );
}

function OuterHtmlEditor({ el, onApply }: { el: HTMLElement; onApply: (code: string) => void }) {
  const clean = () => {
    const c = el.cloneNode(true) as HTMLElement;
    [c, ...c.querySelectorAll("*")].forEach((n) => {
      n.classList.remove(HOVER, SELECTED);
      if (!n.getAttribute("class")) n.removeAttribute("class");
      n.removeAttribute("contenteditable");
    });
    return c.outerHTML;
  };
  const [code, setCode] = useState(clean);
  const tooBig = code.length > 20000;
  return (
    <div className="space-y-2">
      <Textarea
        value={tooBig ? code.slice(0, 20000) : code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        disabled={tooBig}
        className="h-32 font-mono text-[11px] leading-4"
      />
      {tooBig ? (
        <p className="text-[11px] text-muted-foreground">
          Elemento grande demais para editar aqui. Selecione uma parte de dentro ou use a aba
          Código.
        </p>
      ) : (
        <Button size="sm" variant="secondary" className="w-full" onClick={() => onApply(code)}>
          Aplicar código
        </Button>
      )}
    </div>
  );
}

function InsertBlock({ onInsert, after }: { onInsert: (html: string) => void; after?: boolean }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="space-y-2.5">
      <p className="sys-label text-[10px]">
        {after ? "Adicionar depois deste" : "Adicionar no fim da página"}
      </p>
      <div className="grid grid-cols-3 gap-1">
        {Object.entries(SNIPPETS).map(([k, s]) => (
          <SmallButton key={k} onClick={() => onInsert(s.html)}>
            <Plus className="size-3.5" /> {s.label}
          </SmallButton>
        ))}
      </div>
      <Textarea
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder="Ou cole um HTML seu aqui (ex.: um botão gerado pela IA)"
        className="h-16 font-mono text-[11px]"
      />
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={!custom.trim()}
        onClick={() => {
          onInsert(custom);
          setCustom("");
        }}
      >
        Inserir HTML
      </Button>
    </div>
  );
}

function Segmento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-sm border border-primary/20 bg-background/50 p-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BarraBtn({
  onClick,
  title,
  children,
  perigo,
  destaque,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  perigo?: boolean;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-[3px] text-foreground/80 transition-colors hover:bg-primary/20 hover:text-foreground",
        perigo && "hover:bg-destructive/20 hover:text-destructive",
        destaque && "bg-gold/20 text-gold",
      )}
    >
      {children}
    </button>
  );
}

/** Área de texto que aplica ao sair do campo (ou Ctrl+Enter). */
function CommitTextarea({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          commit();
        }
      }}
      className="min-h-20 text-sm"
    />
  );
}

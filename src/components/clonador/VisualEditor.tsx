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
  ChevronsDownUp,
  ChevronsUpDown,
  CopyPlus,
  EyeOff,
  Hand,
  ImagePlus,
  Monitor,
  MousePointer2,
  PencilLine,
  Plus,
  Redo2,
  RotateCcw,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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

  return (
    <div className="flex flex-col lg:flex-row">
      {/* Área do site */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 border-b border-primary/20 bg-background/60 p-2">
          <ToolButton
            active={tool === "selecionar"}
            onClick={() => setTool("selecionar")}
            title="Selecionar"
          >
            <MousePointer2 className="size-4" />
          </ToolButton>
          <ToolButton
            active={tool === "mover"}
            onClick={() => setTool("mover")}
            title="Mover livre (arrastar)"
          >
            <Hand className="size-4" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolButton onClick={undo} title="Desfazer (Ctrl+Z)" disabled={!undoRef.current.length}>
            <Undo2 className="size-4" />
          </ToolButton>
          <ToolButton onClick={redo} title="Refazer (Ctrl+Y)" disabled={!redoRef.current.length}>
            <Redo2 className="size-4" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-border" />
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
          <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground sm:block">
            {tool === "mover"
              ? "Arraste qualquer elemento"
              : "Clique para selecionar · dois cliques para editar texto ou imagem"}
          </span>
        </div>
        <div className="flex justify-center bg-background/80">
          <iframe
            ref={frameRef}
            title="Editor visual do site"
            srcDoc={html}
            sandbox="allow-same-origin"
            onLoad={onLoad}
            style={{ width: VIEWPORT_WIDTH[viewport] }}
            className="block h-[70dvh] max-w-full bg-white transition-[width] duration-300"
          />
        </div>
      </div>

      {/* Painel de propriedades */}
      <aside className="max-h-[70dvh] w-full shrink-0 overflow-y-auto border-t border-primary/20 bg-background/70 lg:w-80 lg:border-t-0 lg:border-l">
        {!el ? (
          <div className="space-y-4 p-4">
            <p className="sys-label">[ Inspetor ]</p>
            <p className="text-sm text-muted-foreground">
              Clique em qualquer parte do site para selecionar. Você pode editar o texto, mudar
              cores e tamanhos, mover, duplicar ou apagar.
            </p>
            <ul className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
              <li>2 cliques · editar texto / trocar imagem</li>
              <li>Delete · apagar</li>
              <li>Ctrl+D · duplicar</li>
              <li>Ctrl+Z / Ctrl+Y · desfazer / refazer</li>
              <li>Esc · soltar seleção</li>
            </ul>
            <InsertBlock onInsert={insertAfter} />
          </div>
        ) : (
          <div className="space-y-5 p-4">
            <div className="space-y-2">
              <p className="sys-label">[ Selecionado ]</p>
              <p className="truncate rounded-sm border border-primary/25 bg-primary/5 px-2 py-1 font-mono text-xs text-primary">
                {describe(el)}
              </p>
              <div className="flex gap-1">
                <SmallButton
                  onClick={() =>
                    el.parentElement && el.tagName !== "BODY" && select(el.parentElement)
                  }
                  title="Selecionar o elemento de fora"
                >
                  <ChevronsUpDown className="size-3.5" /> Pai
                </SmallButton>
                <SmallButton
                  onClick={() =>
                    el.firstElementChild && select(el.firstElementChild as HTMLElement)
                  }
                  title="Selecionar o primeiro elemento de dentro"
                >
                  <ChevronsDownUp className="size-3.5" /> Filho
                </SmallButton>
              </div>
            </div>

            <Section title="Ações">
              <div className="grid grid-cols-3 gap-1">
                <SmallButton
                  onClick={() =>
                    isImg
                      ? pickImage(el as HTMLImageElement)
                      : editingText
                        ? stopTextEdit()
                        : startTextEdit(el)
                  }
                  active={editingText}
                >
                  {isImg ? <ImagePlus className="size-3.5" /> : <PencilLine className="size-3.5" />}
                  {isImg ? "Trocar" : editingText ? "Pronto" : "Texto"}
                </SmallButton>
                <SmallButton onClick={duplicate}>
                  <CopyPlus className="size-3.5" /> Duplicar
                </SmallButton>
                <SmallButton onClick={remove} danger>
                  <Trash2 className="size-3.5" /> Apagar
                </SmallButton>
                <SmallButton onClick={moveUp}>
                  <ArrowUp className="size-3.5" /> Subir
                </SmallButton>
                <SmallButton onClick={moveDown}>
                  <ArrowDown className="size-3.5" /> Descer
                </SmallButton>
                <SmallButton
                  onClick={() => act((x) => x.style.setProperty("display", "none", "important"))}
                >
                  <EyeOff className="size-3.5" /> Ocultar
                </SmallButton>
              </div>
              {el.style.translate && (
                <SmallButton
                  onClick={() => act((x) => x.style.removeProperty("translate"))}
                  className="w-full"
                >
                  <RotateCcw className="size-3.5" /> Voltar para a posição original
                </SmallButton>
              )}
            </Section>

            {isImg && (
              <Section title="Imagem">
                <Field label="Endereço da imagem">
                  <CommitInput
                    value={(el as HTMLImageElement).getAttribute("src") || ""}
                    onCommit={(v) => act((x) => (x as HTMLImageElement).setAttribute("src", v))}
                  />
                </Field>
                <Field label="Texto alternativo">
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
              </Section>
            )}

            {link && (
              <Section title="Link">
                <Field label="Para onde leva">
                  <CommitInput
                    value={link.getAttribute("href") || ""}
                    placeholder="https://wa.me/55..."
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
              </Section>
            )}

            <Section title="Texto">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Cor">
                  <ColorInput
                    value={rgbToHex(cs?.color || "#000")}
                    onStart={pushHistory}
                    onChange={(v) => setStyle("color", v)}
                  />
                </Field>
                <Field label="Tamanho">
                  <CommitInput
                    value={cs?.fontSize || ""}
                    onCommit={(v) =>
                      act(() => setStyle("font-size", /^\d+$/.test(v) ? `${v}px` : v))
                    }
                  />
                </Field>
              </div>
              <Field label="Peso">
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
                      active={cs?.textAlign === v || (v === "left" && cs?.textAlign === "start")}
                      onClick={() => act(() => setStyle("text-align", v))}
                    >
                      <Icon className="size-3.5" />
                    </SmallButton>
                  ))}
                </div>
              </Field>
              <Field label="Fonte">
                <CommitInput
                  value={cs?.fontFamily || ""}
                  onCommit={(v) => act(() => setStyle("font-family", v))}
                />
              </Field>
            </Section>

            <Section title="Caixa">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Fundo">
                  <ColorInput
                    value={rgbToHex(cs?.backgroundColor || "#fff")}
                    onStart={pushHistory}
                    onChange={(v) => setStyle("background-color", v)}
                  />
                </Field>
                <Field label="Cantos">
                  <CommitInput
                    value={cs?.borderRadius || ""}
                    onCommit={(v) =>
                      act(() => setStyle("border-radius", /^\d+$/.test(v) ? `${v}px` : v))
                    }
                  />
                </Field>
                <Field label="Espaço dentro">
                  <CommitInput
                    value={cs?.padding || ""}
                    onCommit={(v) => act(() => setStyle("padding", /^\d+$/.test(v) ? `${v}px` : v))}
                  />
                </Field>
                <Field label="Espaço fora">
                  <CommitInput
                    value={cs?.margin || ""}
                    onCommit={(v) => act(() => setStyle("margin", /^\d+$/.test(v) ? `${v}px` : v))}
                  />
                </Field>
                <Field label="Largura">
                  <CommitInput
                    value={el.style.width || cs?.width || ""}
                    onCommit={(v) => act(() => setStyle("width", /^\d+$/.test(v) ? `${v}px` : v))}
                  />
                </Field>
                <Field label="Altura">
                  <CommitInput
                    value={el.style.height || cs?.height || ""}
                    onCommit={(v) => act(() => setStyle("height", /^\d+$/.test(v) ? `${v}px` : v))}
                  />
                </Field>
              </div>
              <Field label={`Transparência · ${Math.round(parseFloat(cs?.opacity || "1") * 100)}%`}>
                <Slider
                  value={[parseFloat(cs?.opacity || "1") * 100]}
                  min={0}
                  max={100}
                  step={5}
                  onPointerDown={pushHistory}
                  onValueChange={([v]) => setStyle("opacity", String((v ?? 100) / 100))}
                />
              </Field>
              <p className="text-[11px] text-muted-foreground">
                Aceita px, %, auto… Ex.: 20px, 50%, 10px 20px.
              </p>
            </Section>

            <Section title="Código do elemento">
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
            </Section>

            <InsertBlock onInsert={insertAfter} after />
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
        "flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:opacity-35",
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

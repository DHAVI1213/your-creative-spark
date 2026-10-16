import type { Settings,Meta } from './model';
type ImageSource = HTMLImageElement|HTMLVideoElement|HTMLCanvasElement;
export type DrawOptions={CW:number;CH:number;meta:Meta;frame?:ImageSource|null;bgImg?:HTMLImageElement|null;custom?:HTMLImageElement|null;logo?:HTMLImageElement|null;title?:string;placeholder?:boolean};
export function drawBackground(ctx:CanvasRenderingContext2D,s:Settings,W:number,H:number,img?:HTMLImageElement|null):void;
export function drawOverlay(ctx:CanvasRenderingContext2D,s:Settings,caption:string,W:number,H:number,logo?:HTMLImageElement|null,opts?:{keep?:boolean;placeholder?:boolean}):void;
export function drawCover(ctx:CanvasRenderingContext2D,s:Settings,o:DrawOptions):void;
export function drawMini(ctx:CanvasRenderingContext2D,s:Settings,o:{meta:Meta;frame?:ImageSource|null;bgImg?:HTMLImageElement|null;custom?:HTMLImageElement|null;logo?:HTMLImageElement|null;legenda:string;capa?:{title:string}|null}):void;
export function fontsFor(s:Settings):string[];
export function cssFilter(e:Settings['efeitos']):string;

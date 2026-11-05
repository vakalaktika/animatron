// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { motionValue } from "motion/react";
import { render, screen } from "@testing-library/react";
import { validStageMask, pointInStageMask } from "./stageMask";
import { StageCanvas } from "../StageCanvas";
import { makeText, parseImport } from "@/app/motion-studio/presets";
import { normalizeDoc } from "@/app/motion-studio/lib/migrate";
import type { StudioDoc } from "../types";
const region = [{x:10,y:10},{x:90,y:10},{x:90,y:80},{x:10,y:80}];
const mask = {regions:[region]};
const fixture = (): StudioDoc => ({version:2,name:"Window",stage:{width:100,height:100,background:"#fff",transparent:false},clips:[{...makeText({id:"bird",text:"Bird",x:50,y:50,start:0}),stageMask:mask}]});
describe("stage-space visibility regions",()=>{
 test("validates bounded polygon unions and rejects malformed or degenerate regions",()=>{
  expect(validStageMask(mask)).toBe(true);
  for(const bad of [null,{}, {regions:[]}, {regions:[region.slice(0,2)]},{regions:Array(17).fill(region)}, {regions:[Array(65).fill({x:1,y:2})]}, {regions:[[{x:0,y:0},{x:1,y:1},{x:2,y:2}]]},{regions:[[...region.slice(0,3),{x:NaN,y:2}]]},{regions:[[...region.slice(0,3),{x:Infinity,y:2}]]},{regions:[region],markup:"<script/>"}])expect(validStageMask(bad)).toBe(false);
 });
 test("union membership includes edges and excludes frame gaps",()=>{
  const panes={regions:[region,region.map(p=>({...p,x:p.x+100}))]};
  expect(pointInStageMask(panes,{x:50,y:50})).toBe(true);
  expect(pointInStageMask(panes,{x:10,y:10})).toBe(true);
  expect(pointInStageMask(panes,{x:95,y:50})).toBe(false);
  expect(pointInStageMask(panes,{x:150,y:50})).toBe(true);
 });
 test("imports valid masks unchanged, rejects invalid imports and removes invalid stored clips",()=>{
  const doc=fixture();
  const result=parseImport(JSON.parse(JSON.stringify(doc)));
  expect(result.kind).toBe("doc");
  if(result.kind==="doc")expect(result.doc.clips[0].stageMask).toEqual(mask);
  const bad={...doc,clips:[{...doc.clips[0],stageMask:{regions:[]}}]};
  expect(parseImport(bad).kind).toBe("error");
  const normalized=normalizeDoc(bad);
  expect(normalized.doc.clips).toEqual([]);
  expect(normalized.warnings.join(" ")).toMatch(/mask/i);
 });
 test("keeps clipping outside the moving clip transform and scopes IDs per instance",()=>{
  const doc=fixture();
  const {container}=render(<><StageCanvas doc={doc} time={motionValue(1)} /><StageCanvas doc={doc} time={motionValue(1)} /></>);
  const wrappers=container.querySelectorAll('[data-stage-mask="bird"]');
  expect(wrappers).toHaveLength(2);
  expect((wrappers[0] as HTMLElement).style.width).toBe("100px");
  expect(wrappers[0].querySelector('[data-clip-id="bird"]')).not.toBeNull();
  expect(container.querySelectorAll('clipPath polygon')).toHaveLength(2);
  const ids=[...container.querySelectorAll('clipPath')].map(n=>n.id);
  expect(new Set(ids).size).toBe(2);
  expect((wrappers[0] as HTMLElement).style.clipPath).toContain(ids[0]);
 });
 test("invalid in-memory masks fail closed and legacy clips render without wrappers",()=>{
  const doc=fixture();
  const bad={...doc,clips:[{...doc.clips[0],stageMask:{regions:[]}}]};
  const view=render(<StageCanvas doc={bad} time={motionValue(0)} />);
  expect(view.container.querySelector('[data-clip-id]')).toBeNull();
  view.rerender(<StageCanvas doc={{...doc,clips:[makeText({id:"plain",text:"Plain"})]}} time={motionValue(0)} />);
  expect(view.container.querySelector('[data-clip-id="plain"]')).not.toBeNull();
  expect(view.container.querySelector('[data-stage-mask]')).toBeNull();
 });
});

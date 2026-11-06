import type { Clip, RigAsset } from "../types";
import type { MotionConstraint, MotionProgram } from "./motionTypes";

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e7;
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(v);
const clipRef = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(v);
const time = (v: unknown): v is number => finite(v) && v >= 0 && v <= 600;
const props = new Set(["x", "y", "rotation", "scale", "opacity"]);
const allowedEase = new Set(["linear", "smoothOut", "inOut", "flight", "backOut", "anticipate", "snap", "custom"]);
export const MOTION_LIMITS = { operators: 128, keys: 10000, pathPoints: 256, repeats: 100, documentChars:16_000_000, documentValues:250_000 } as const;

/** Bound total work without serializing or copying large PNG payload strings. */
function withinDocumentBudget(raw:unknown):boolean {
  const pending:unknown[]=[raw];let values=0,chars=0;
  while(pending.length){
    if(++values>MOTION_LIMITS.documentValues)return false;
    const value=pending.pop();
    if(typeof value==="string"){chars+=value.length;if(chars>MOTION_LIMITS.documentChars)return false;}
    else if(value&&typeof value==="object"){
      const entries=Object.entries(value);if(entries.length+pending.length>MOTION_LIMITS.documentValues)return false;
      for(const [key,item] of entries){chars+=key.length;pending.push(item);}
      if(chars>MOTION_LIMITS.documentChars)return false;
    }
  }
  return true;
}

function keys(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0 && raw.length <= MOTION_LIMITS.keys && raw.every((k, i) =>
    record(k) && time(k.time) && finite(k.value) && (i === 0 || (raw[i - 1] as {time:number}).time < k.time) &&
    (k.ease === undefined || ease(k.ease)));
}
function ease(raw: unknown): boolean {
  return record(raw) && typeof raw.name === "string" && allowedEase.has(raw.name) &&
    (raw.name !== "custom" || Array.isArray(raw.custom) && raw.custom.length === 4 && raw.custom.every(finite) && raw.custom[0] >= 0 && raw.custom[0] <= 1 && raw.custom[2] >= 0 && raw.custom[2] <= 1);
}
const known = (raw: Record<string, unknown>, names: string[]) => Object.keys(raw).every(k => names.includes(k));
const common = ["id", "name", "enabled"];
const blockFields = [...common, "controllerId", "start", "duration", "repeat", "alternate", "ease"];
const constraintFields = [...common, "start", "end", "weight", "weightKeys"];

function programErrors(raw: unknown, portable: boolean): string[] {
  if (raw === undefined) return [];
  if (!record(raw) || !known(raw,["controllers","blocks","constraints"])) return ["Expected a declarative motion program."];
  const errors: string[]=[];
  const fail=(s:string)=>errors.push(s);
  const arrays=[raw.controllers,raw.blocks,raw.constraints];
  if (arrays.some(a=>a!==undefined && !Array.isArray(a))) return ["Motion collections must be arrays."];
  if (arrays.reduce<number>((n,a)=>n+(Array.isArray(a)?a.length:0),0)>MOTION_LIMITS.operators) return ["Motion exceeds 128 operators."];
  for (const [kind,items] of Object.entries(raw)) {
    const ids=new Set<string>();
    for (const item of (items ?? []) as unknown[]) {
      if (!record(item) || !id(item.id) || ids.has(item.id)) { fail(`Motion ${kind} need unique valid IDs.`); continue; }
      ids.add(item.id);
      if (item.name!==undefined && (typeof item.name!=="string" || item.name.length>200)) fail("Invalid motion name.");
      if (item.enabled!==undefined && typeof item.enabled!=="boolean") fail("Invalid motion enabled flag.");
      if (kind==="controllers") {
        if (!known(item,["id","name","space","x","y","rotation","clipId","slotId","keys"]) || !["rig","stage","object"].includes(item.space as string) || !finite(item.x) || !finite(item.y) || item.rotation!==undefined&&!finite(item.rotation)) fail("Invalid motion controller.");
        if (item.clipId!==undefined&&!clipRef(item.clipId) || item.slotId!==undefined&&!id(item.slotId)) fail("Invalid controller reference.");
        if (item.space!=="object"&&(item.clipId!==undefined||item.slotId!==undefined)) fail("Only object-space controllers can reference clips or sockets.");
        if (portable && item.space!=="rig") fail("Portable controllers require rig space; external references are not portable.");
        if (item.keys!==undefined && (!record(item.keys) || !known(item.keys,["x","y","rotation"]) || !Object.values(item.keys).every(keys))) fail("Invalid sparse controller keys.");
      } else if (kind==="blocks") {
        if (!time(item.start)||!time(item.duration)||item.duration<=0 || item.repeat!==undefined&&(!Number.isInteger(item.repeat)||Number(item.repeat)<1||Number(item.repeat)>MOTION_LIMITS.repeats) || item.alternate!==undefined&&typeof item.alternate!=="boolean" || item.controllerId!==undefined&&!id(item.controllerId) || item.ease!==undefined&&!ease(item.ease)) fail("Invalid motion block timing or target.");
        if (Number(item.start)+Number(item.duration)*Number(item.repeat??1)>600) fail("Motion block ends after 600 seconds.");
        if (item.type==="path") {
          if (!known(item,[...blockFields,"type","points","closed","orient","facingOffset"]) || !Array.isArray(item.points)||item.points.length<2||item.points.length>MOTION_LIMITS.pathPoints || !item.points.every(p=>record(p)&&finite(p.x)&&finite(p.y)) || item.closed!==undefined&&typeof item.closed!=="boolean" || item.orient!==undefined&&typeof item.orient!=="boolean" || item.facingOffset!==undefined&&!finite(item.facingOffset)) fail("Invalid path block.");
        } else if (item.type==="transform") {
          if (!known(item,[...blockFields,"type","from","to"]) || ![item.from,item.to].every(v=>record(v)&&Object.keys(v).every(p=>props.has(p))&&Object.values(v).every(finite))) fail("Invalid transform block.");
          if(item.controllerId!==undefined&&[item.from,item.to].some(v=>record(v)&&Object.keys(v).some(k=>k==="scale"||k==="opacity"))) fail("Controllers do not have scale or opacity tracks.");
        } else if (item.type==="oscillate") {
          if (!known(item,[...blockFields,"type","property","amplitude","cycles","phase"]) || !props.has(item.property as string)||!finite(item.amplitude) || item.cycles!==undefined&&(!finite(item.cycles)||item.cycles<=0||item.cycles>1000) || item.phase!==undefined&&!finite(item.phase)) fail("Invalid oscillation block.");
          if(item.controllerId!==undefined&&(item.property==="scale"||item.property==="opacity")) fail("Controllers cannot oscillate scale or opacity.");
        } else fail("Unknown motion block operator.");
      } else {
        if (item.start!==undefined&&!time(item.start) || item.end!==undefined&&!time(item.end) || Number(item.end??600)<Number(item.start??0) || item.weight!==undefined&&(!finite(item.weight)||item.weight<0||item.weight>1) || item.weightKeys!==undefined&&(!keys(item.weightKeys)||(item.weightKeys as {value:number}[]).some(k=>k.value<0||k.value>1))) fail("Invalid constraint interval or influence.");
        if(item.type==="ik") {
          if(!known(item,[...constraintFields,"type","rootId","midId","tipId","targetId","bend"])||![item.rootId,item.midId,item.tipId,item.targetId].every(id)||![1,-1].includes(item.bend as number)) fail("Invalid two-bone IK constraint.");
        } else if(item.type==="aim") {
          if(!known(item,[...constraintFields,"type","boneId","targetId","offset"])||!id(item.boneId)||!id(item.targetId)||item.offset!==undefined&&!finite(item.offset)) fail("Invalid aim constraint.");
        } else if(item.type==="attach") {
          if(!known(item,[...constraintFields,"type","targetClipId","slotId","offset","followRotation"])||!clipRef(item.targetClipId)||item.slotId!==undefined&&!id(item.slotId)||!record(item.offset)||![item.offset.x,item.offset.y,item.offset.rotation].every(finite)||item.followRotation!==undefined&&typeof item.followRotation!=="boolean") fail("Invalid attachment constraint.");
          if(portable) fail("Portable rigs cannot contain external scene attachments.");
        } else fail("Unknown motion constraint operator.");
      }
    }
  }
  const totalKeys = Object.values(raw).flatMap(items => Array.isArray(items) ? items : []).reduce((sum, item) => {
    if (!record(item)) return sum;
    const tracks = record(item.keys) ? Object.values(item.keys) : [];
    return sum + [...tracks, item.weightKeys].reduce<number>((n, track) => n + (Array.isArray(track) ? track.length : 0), 0);
  }, 0);
  if (totalKeys > MOTION_LIMITS.keys) fail("Motion exceeds 10000 combined controller and influence keys.");
  return errors;
}

const merge = <T extends {id:string}>(a:T[]|undefined,b:T[]|undefined):T[]=>Array.from(new Map([...(a??[]),...(b??[])].map(x=>[x.id,x])).values());
export function mergedMotion(clip: Clip): Required<MotionProgram> {
  const base=clip.type==="rig"?clip.rig.motion:undefined;
  return {controllers:merge(base?.controllers,clip.motion?.controllers),blocks:merge(base?.blocks,clip.motion?.blocks),constraints:merge(base?.constraints,clip.motion?.constraints)};
}

function references(clip: Clip, program: Required<MotionProgram>, clips: Map<string,Clip>, portable=false): string[] {
  const errors:string[]=[]; const fail=(s:string)=>errors.push(`${clip.id}: ${s}`);
  const controllers=new Map(program.controllers.map(c=>[c.id,c]));
  const bones=clip.type==="rig"?new Map(clip.rig.bones.map(b=>[b.id,b])):new Map();
  for(const c of program.controllers) {
    if(c.space==="rig"&&clip.type!=="rig") fail("Rig-space controller needs a rig.");
    if(c.space==="object") {
      const target=clips.get(c.clipId??clip.id);
      if(!target) fail(`Missing controller object ${c.clipId}.`);
      if(c.slotId&&(target?.type!=="rig"||!target.rig.slots?.some(s=>s.id===c.slotId))) fail(`Missing target socket ${c.slotId}.`);
    }
  }
  for(const b of program.blocks) if(b.controllerId&&!controllers.has(b.controllerId)) fail(`Missing controller ${b.controllerId}.`);
  for(const c of program.constraints) {
    if(c.type==="attach") {
      const target=clips.get(c.targetClipId);
      if(!target) fail(`Missing attachment target ${c.targetClipId}.`);
      if(c.slotId&&(target?.type!=="rig"||!target.rig.slots?.some(s=>s.id===c.slotId))) fail(`Missing attachment socket ${c.slotId}.`);
    } else {
      const controller=controllers.get(c.targetId);
      if(controller?.space==="object" && (!controller.clipId || controller.clipId===clip.id) && controller.slotId) fail("A constraint cannot target a socket on its own rig; use an independent controller.");
      if(clip.type!=="rig") fail("Bone constraints need a rig.");
      if(!controllers.has(c.targetId)) fail(`Missing target controller ${c.targetId}.`);
      if(c.type==="aim"&&!bones.has(c.boneId)) fail(`Missing aim bone ${c.boneId}.`);
      if(c.type==="ik") {
        if(![c.rootId,c.midId,c.tipId].every(b=>bones.has(b))) fail("Missing IK bones.");
        else if(bones.get(c.midId)?.parentId!==c.rootId||bones.get(c.tipId)?.parentId!==c.midId) fail("IK requires a direct root/mid/tip chain.");
        if(new Set([c.rootId,c.midId,c.tipId]).size!==3) fail("IK joints must be distinct.");
      }
    }
  }
  const writes=(c:MotionConstraint)=>c.type==="attach"?["placement"]:c.type==="aim"?[c.boneId]:[c.rootId,c.midId];
  for(let i=0;i<program.constraints.length;i++) for(let j=i+1;j<program.constraints.length;j++) {
    const a=program.constraints[i],b=program.constraints[j];
    if(a.enabled===false||b.enabled===false) continue;
    const overlap=Math.max(a.start??0,b.start??0)<Math.min(a.end??600,b.end??600);
    if(overlap&&writes(a).some(k=>writes(b).includes(k))) fail(`Conflicting drivers ${a.id} and ${b.id}.`);
  }
  if(portable&&program.controllers.some(c=>c.space!=="rig")) fail("Portable controllers require rig space.");
  return errors;
}

export function validateRigMotion(raw: unknown): string[] {
  if(!record(raw)||raw.motion===undefined) return [];
  const errors=programErrors(raw.motion,true);
  if(raw.version!==4) errors.push("Motion controls require Rig version 4.");
  if(!errors.length&&Array.isArray(raw.bones)) {
    const clip={id:"rig",type:"rig",rig:raw} as unknown as Clip;
    errors.push(...references(clip,mergedMotion(clip),new Map([[clip.id,clip]]),true));
  }
  return errors;
}

export function validateMotionDocument(raw: unknown): string[] {
  if(!record(raw)||!Array.isArray(raw.clips)) return ["Motion validation needs a document with clips."];
  const errors:string[]=[];
  const clips=(raw.clips.filter(record) as unknown as Clip[]);
  const byId=new Map(clips.map(c=>[c.id,c]));
  const usesMotion=clips.some(c=>c.motion!==undefined||c.type==="rig"&&(c.rig?.motion!==undefined||c.rig?.version===4));
  if((raw.version===4||usesMotion)&&!withinDocumentBudget(raw))return ["Motion document exceeds its combined text/value resource budget."];
  if(raw.version===4&&clips.some(c=>c.type==="rig"&&(!record(c.rig)||!Array.isArray(c.rig.bones)||!Array.isArray(c.rig.bindings)||!Array.isArray(c.rig.animations)))) return ["Motion rig dependencies require valid rig assets."];
  if(!usesMotion) return [];
  if(clips.length>512) return ["Motion documents support at most 512 clips."];
  if(byId.size!==clips.length) return ["Motion documents require unique clip IDs."];
  if(clips.some(c=>c.type==="rig"&&(!record(c.rig)||!Array.isArray(c.rig.bones)||!Array.isArray(c.rig.bindings)||!Array.isArray(c.rig.animations)))) return ["Motion rig dependencies require valid rig assets."];
  if(usesMotion&&raw.version!==4) errors.push("Motion controls require document version 4.");
  for(const c of clips) {
    errors.push(...programErrors(c.motion,false).map(e=>`${c.id}: ${e}`));
    if(c.type==="rig") errors.push(...validateRigMotion(c.rig));
  }
  if(errors.length) return errors;
  for(const c of clips) {
    const merged=mergedMotion(c);
    errors.push(...programErrors(merged,false),...references(c,merged,byId));
    if(c.parentId&&!byId.has(c.parentId))errors.push(`Missing motion parent ${c.parentId}.`);
  }
  const visiting=new Set<string>(),done=new Set<string>();
  const visit=(clip:Clip)=>{
    if(visiting.has(clip.id)) { errors.push(`Motion dependency cycle at ${clip.id}.`); return; }
    if(done.has(clip.id)) return;
    visiting.add(clip.id);
    const p=mergedMotion(clip);
    const deps=[clip.parentId,...p.controllers.filter(c=>c.space==="object"&&c.clipId!==clip.id).map(c=>c.clipId),...p.constraints.filter(c=>c.type==="attach"&&c.enabled!==false).map(c=>c.type==="attach"?c.targetClipId:undefined)].filter((x):x is string=>!!x);
    for(const dep of deps) { const target=byId.get(dep); if(target) visit(target); }
    visiting.delete(clip.id);done.add(clip.id);
  };
  clips.forEach(visit);
  return errors;
}

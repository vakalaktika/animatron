// Authored editable artwork. No traced/private reference image is embedded here.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), core=require('../../docs/mci-rig/mci-rig-core.cjs');
const out=new URL('./',import.meta.url), save=(name,v)=>fs.writeFileSync(new URL(name,out),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const P={ink:'#263f49',cream:'#fff3d9',paper:'#fff8e7',ochre:'#dba947',gold:'#edc56a',coral:'#cc7259',teal:'#527b79',sage:'#a7b49a',skin:'#e7ad79',shade:'#ce8d61',hair:'#49352c',sky:'#bad6d8'};
const path=(d,fill,stroke='',sw=2)=>`<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`:''}/>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const ellipse=(x,y,rx,ry,fill)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const g=(id,art)=>`<g id="${id}">${art}</g>`;
const svg=art=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">${art}</svg>`;
const key=(time,rotation=0,x=0,y=0)=>({time,x,y,rotation,easing:'linear',tween:{name:'inOut'}});
const track=(boneId,values)=>({boneId,keys:values.map(v=>key(...v))});
const bone=(id,parentId,x,y,rotation=0,length=0,role=id)=>({id,parentId,role,rest:{x,y,rotation},length});
function rig(name,groups,bones,tracks=[],drawingSets=[],drawingTracks=[]){
 const r={format:'mid-century-ink-rig',version:4,name,canvas:{width:1280,height:720},svg:svg(groups.map(([id,art])=>g(id,art)).join('')),bones,bindings:[],drawingSets,animations:[{id:'performance',name:'Authored performance',duration:8,loop:true,tracks,drawingTracks}],metadata:{treatment:name.startsWith('Original')?'classic-graphic':'detailed-storybook',identityStatus:'invented; provisional; not user-approved',artwork:'Native authored paths; private style sources are not embedded.'}};
 const worlds=core.world(r);r.bindings=groups.map(([id,,bound='root'])=>({id,svgId:id,boneId:bound,bindMatrix:core.inverse(worlds[bound])}));return r;
}
const clip=(id,name,r)=>({id,name,type:'rig',enabled:true,start:0,x:640,y:360,scale:1,parentId:null,followRotation:true,rig:r,animationId:'performance',pose:{}});
const doc=(name,clips,scenePlan)=>({version:4,name,description:'Editable vector benchmark with independently authored artwork and sparse controller motion. Invented characters; no identity approval claimed.',timeline:{duration:8,loop:true,tailSeconds:0},stage:{width:1280,height:720,background:P.cream,transparent:false},clips,scenePlan});

// Detailed: a workshop nook; the family forms an open triangular composition.
const room=path('M0 0H1280V720H0Z',P.cream)+path('M0 526H1280V720H0Z','#dec5a0')+
 path('M690 36H1230V477H690Z',P.ink)+path('M707 53H1213V459H707Z',P.sky)+
 path('M707 344Q789 283 844 342Q938 269 998 336Q1118 253 1213 306V459H707Z','#9aafa2')+
 path('M707 398Q809 359 896 401Q1030 347 1213 394V459H707Z','#7e9e93')+
 path('M949 45H962V465H949Z',P.ink)+path('M698 282H1220V294H698Z',P.ink)+
 path('M665 467H1254V486H665Z','#c99c69')+
 path('M77 68H301V82H77ZM77 218H301V233H77Z',P.teal)+
 path('M92 117L105 91L118 208H102Z',P.coral)+path('M126 101H151V208H126Z',P.ochre)+path('M162 134H182V208H162Z',P.ink)+path('M193 111H218V208H193Z',P.sage)+path('M230 152H263V208H230Z',P.coral)+
 path('M68 237H84V438H68Z',P.teal)+path('M287 237H302V438H287Z',P.teal)+path('M77 407H301V422H77Z',P.teal)+
 path('M99 353Q94 314 109 286Q117 307 115 337Q131 303 148 302Q149 323 126 351Q151 335 164 347Q155 366 128 368Z',P.sage)+path('M93 365H151L144 406H100Z',P.coral)+
 path('M1133 50Q1110 86 1139 95Q1098 107 1113 132Q1139 142 1167 115Q1150 151 1178 157Q1200 154 1213 126V53Z',P.sage)+
 path('M1046 52V112', 'none',P.ink,3)+path('M997 148L1046 113L1096 148Z',P.coral)+path('M1006 149H1088V194H1006Z',P.paper)+path('M997 194H1098L1089 205H1007Z',P.coral)+
 path('M0 531H1280', 'none','#b98d60',3)+path('M34 680L1230 703','none','#ecd8b7',4);

// Parent: softly faceted features, selective strokes, intact garment overlaps.
const adultBody=path('M161 350Q197 329 221 339L250 364Q275 359 296 380L336 482L299 540L166 535L130 455Z',P.teal)+
 path('M163 514Q199 535 241 515L287 521L313 633L255 648L216 560L192 643L134 639Z',P.ink)+
 path('M134 633L193 635L188 663Q157 671 117 660Q115 649 134 633ZM254 642L306 627L334 655Q332 671 310 671L256 665Z','#1e333b')+
 path('M208 344L221 367L248 354L234 388L210 372L191 388L190 351Z','#73938a')+
 path('M176 386Q158 409 152 443L204 465L199 487Q144 484 124 460Q120 449 132 409Z','#bd815c')+
 path('M288 388Q319 404 339 444L369 479L354 497Q316 476 292 445L270 418Z','#bd815c')+
 path('M203 462Q218 459 239 467L267 483Q269 489 262 491L237 480L255 495Q256 502 249 503L224 487L241 505Q239 512 231 508L207 492Q196 486 196 476Z','#bd815c')+
 path('M174 410L168 450M265 398L283 431','none','#385b5e',2.5);
const adultHead=path('M196 322L196 353Q213 368 233 351L239 314Z','#b87853')+
 path('M163 239Q159 207 184 190Q216 174 242 195L251 220L251 247L267 266L250 274Q248 307 229 326Q208 337 188 316L170 285Z','#c78c61')+
 path('M166 277Q144 267 153 249Q161 236 177 247L183 267Z','#c78c61')+
 path('M164 250Q151 239 151 217Q145 206 158 199Q151 183 166 177Q168 162 184 167Q192 151 208 162Q224 153 232 168Q251 163 254 181Q271 192 256 212L239 219Q219 209 199 216L183 235L180 262Z',P.hair)+
 path('M194 237Q204 228 217 232L217 237L196 242ZM237 229Q246 226 252 232L251 236L238 235Z',P.hair)+
 path('M195 249Q204 241 215 245Q207 254 195 249ZM236 244Q244 238 251 243Q245 251 236 244Z',P.paper)+
 ellipse(208,247,3.5,5.5,P.ink)+ellipse(246,242,3,5,P.ink)+
 path('M231 247L237 266L226 269','none','#8e563d',2)+
 path('M211 289Q228 298 242 285','none','#784c37',2.5)+
 path('M161 254Q170 251 173 262','none','#a56746',2)+path('M192 312Q209 329 228 326','none','#a56746',2);

// Main character's clothing and complete hidden upper arm are separate groups.
const mainBody=path('M434 385Q461 366 489 381Q516 388 527 416L520 490L501 531L420 531L405 460L410 410Z',P.ochre)+
 path('M439 381Q459 396 484 380L489 393Q462 413 434 394Z',P.cream)+
 path('M414 416Q393 440 390 468Q390 482 409 493L433 481L413 466L427 432Z',P.skin)+
 path('M424 472Q437 470 451 483L464 498Q465 506 456 505L442 493L449 508Q445 516 437 508L425 495L423 507Q414 510 411 497L409 485Z',P.skin)+
 path('M434 421L428 470M489 417L500 484','none','#b18037',2.5);
const mainLegs=path('M421 524Q452 535 479 524L503 534L507 609L469 615L457 560L448 614L412 612Z',P.teal)+
 path('M415 604L448 606L444 649L415 650Z',P.skin)+path('M471 607L505 603L511 644L480 650Z',P.skin)+
 path('M414 640L444 639L445 656L461 666Q457 678 438 677L399 670Q398 654 414 640ZM480 641L509 639L527 657Q527 671 507 674L476 666Z',P.ink);
const shoulder={x:491,y:407}, elbow={x:568,y:443}, wrist={x:597,y:363};
const upper=path('M480 389Q495 379 512 393L578 431Q587 442 575 455Q566 462 553 454L493 425Q478 421 475 407Z',P.ochre)+path('M550 426L568 436','none','#b18037',2);
const fore=path('M556 435Q565 427 578 436Q586 442 581 456L614 374Q619 360 605 353Q590 348 585 363L555 429Z',P.skin)+path('M563 439Q571 436 578 444','none',P.shade,2);
const hand=path('M585 367Q582 354 590 346L605 335Q612 331 615 337L605 348L626 343Q633 344 631 351L612 358L625 357Q631 360 626 365L608 369L600 382Q591 382 585 367Z',P.skin)+path('M596 351L607 349M598 360L609 357','none',P.shade,1.6);
function mainHead(turn=false,blink=false){
 if(turn)return path('M449 350L446 386Q465 402 482 386L478 351Z',P.skin)+
 path('M425 299Q417 268 442 249Q470 230 491 257L501 285L515 303L498 310Q499 336 481 354Q465 365 447 350L433 330Z',P.skin)+
 path('M430 318Q409 314 413 298Q418 284 432 293Z',P.skin)+
 path('M426 309Q410 295 411 278Q409 248 435 233Q456 219 478 234Q495 231 506 252L497 283Q485 273 480 253Q461 278 437 278L433 305Z',P.hair)+
 path('M425 304Q404 331 414 356L436 372Q427 350 438 329Z',P.hair)+
 path('M475 285Q485 278 494 284','none',P.hair,3)+
 (blink?path('M478 296Q486 300 493 294','none',P.ink,2):path('M477 296Q485 286 494 294Q488 302 477 296Z',P.paper)+ellipse(489,294,3.5,5,P.ink))+
 path('M496 299L501 309L493 311','none','#a56546',1.8)+path('M473 331Q487 334 495 323Q486 341 475 336Z','#854c38')+
 path('M420 302Q426 297 431 307','none',P.shade,1.6);
 return path('M445 349L445 386Q463 402 483 385L479 349Z',P.skin)+
 path('M421 295Q416 262 444 244Q472 232 492 254L503 288L502 318Q491 347 472 356Q450 360 436 341L427 320Z',P.skin)+
 path('M429 303Q411 290 407 305Q406 320 426 326Z',P.skin)+
 path('M420 303Q404 284 413 261Q411 246 429 238Q439 222 460 229Q480 221 494 240Q509 242 512 261L501 294L491 286L482 255Q465 279 437 279L431 307Z',P.hair)+
 path('M419 310Q404 335 416 360L437 370Q426 350 438 331Z',P.hair)+
 path('M439 293Q449 284 460 288M477 285Q488 281 495 287','none',P.hair,3)+
 (blink?path('M438 306Q449 311 459 303M477 300Q486 304 494 297','none',P.ink,2):path('M437 306Q446 294 460 302Q451 313 437 306ZM476 300Q483 290 495 297Q488 307 476 300Z',P.paper)+ellipse(452,303,3.7,6,P.ink)+ellipse(489,298,3.4,5.5,P.ink))+
 path('M470 301L475 317L466 319','none','#a56546',1.8)+
 path('M453 333Q472 343 488 327Q482 345 469 346Q460 342 453 333Z','#854c38')+path('M456 333Q472 337 485 330L481 335L463 338Z',P.paper)+
 path('M415 306Q422 303 426 313','none',P.shade,1.6);
}
// Younger sibling, their own descriptive face and hands resting on the bench.
const smallBody=path('M738 422Q763 411 787 425L815 499L735 513L709 470Z',P.coral)+
 path('M725 456L746 439L764 476L793 490L785 506Q747 497 735 484Z','#c98e65')+
 path('M785 449Q808 451 817 475L848 493L841 508Q813 500 799 486Z','#c98e65')+
 path('M781 493Q795 486 811 494L830 505Q831 513 823 513L805 506L817 518Q813 524 805 518L785 510Z','#c98e65')+
 path('M738 500L805 496L808 562L777 571L766 534L756 576L729 572Z',P.ink);
const smallHead=path('M746 402L748 430Q764 443 780 429L782 401Z','#c98e65')+
 path('M730 349Q733 325 760 322Q790 320 802 346L804 370L816 379L802 387Q795 411 776 418Q755 422 740 400L731 381Z','#d7a174')+
 path('M735 373Q716 361 716 376Q717 389 734 391Z','#d7a174')+
 path('M728 373Q708 357 715 342Q707 330 722 323Q720 305 737 307Q744 290 758 303Q777 292 787 307Q806 303 809 321Q821 333 807 349L794 357L787 335Q767 351 745 344L740 370Z',P.hair)+
 path('M745 365Q754 355 766 360M780 358Q791 353 799 360','none',P.hair,2.8)+
 path('M745 376Q753 365 767 371Q758 382 745 376ZM780 370Q788 361 800 366Q791 378 780 370Z',P.paper)+ellipse(760,372,3.5,5.8,P.ink)+ellipse(793,367,3.4,5,P.ink)+
 path('M775 375L780 385L773 388','none','#99613f',1.7)+
 path('M757 399Q775 409 790 393Q785 410 772 410Z','#854c38')+path('M760 399Q775 403 786 396L782 402L766 404Z',P.paper);
const foreground=path('M73 513L1065 490L1220 568L160 611Z',P.gold)+path('M160 611L1220 568V594L160 637Z','#c99545')+
 path('M199 632L231 630L209 720H181ZM1110 599L1140 596L1166 720H1138Z',P.ink)+
 path('M280 549L385 534L436 552L332 570Z',P.paper)+path('M338 544L396 540L407 553L351 558Z',P.coral)+
 path('M854 532L929 516L1032 546L889 569Z',P.paper)+path('M854 532L943 536L889 569Z','#dfc797')+
 path('M926 535L970 528L943 546Z',P.ochre)+
 path('M1020 508L1050 505L1059 541L1034 545Z',P.teal)+path('M1033 510L1024 480M1040 510L1042 475M1047 510L1060 480','none',P.ink,4)+
 path('M611 552L687 541L699 546L622 558Z',P.coral)+path('M621 554L687 543','none',P.cream,2)+
 path('M119 517Q107 491 105 475Q99 452 116 452Q131 457 127 484Q143 460 155 472Q159 489 139 512L158 511L150 550L117 551Z',P.teal);

const familyBones=[bone('root',null,0,0),bone('adult-body','root',220,470),bone('adult-head','adult-body',-10,-191),bone('body','root',445,475),bone('upper-arm','body',46,-68,25,85),bone('forearm','upper-arm',85,0,-95,85),bone('hand','forearm',85,0,70),bone('head','body',20,-165),bone('little-body','root',765,490),bone('little-head','little-body',0,-122)];
// Recompute the authored arm origins exactly from the skeleton for zero-gap binding.
const familyGroups=[['room',room],['adult-body-art',adultBody,'adult-body'],['adult-head-art',adultHead,'adult-head'],['girl-legs',mainLegs],['girl-body',mainBody,'body'],['girl-upper',upper,'upper-arm'],['girl-forearm',fore,'forearm'],['girl-hand',hand,'hand'],['head-front',mainHead(false,false),'head'],['head-front-blink',mainHead(false,true),'head'],['head-turn',mainHead(true,false),'head'],['head-turn-blink',mainHead(true,true),'head'],['little-body-art',smallBody,'little-body'],['little-head-art',smallHead,'little-head'],['bench',foreground]];
const headKeys=[[0,'front'],[1.0,'front-blink'],[1.12,'front'],[2.0,'turn'],[3.7,'turn-blink'],[3.82,'turn'],[5.5,'front'],[8,'front']].map(([time,drawingId])=>({time,drawingId}));
const family=rig('Detailed — The workshop glider',familyGroups,familyBones,[track('body',[[0,0],[0.65,-1],[1.7,1.8],[4.3,1.8],[5.8,-0.6],[6.8,0],[8,0]]),track('adult-head',[[0,-1],[1.8,2],[4.5,2],[6.5,-1],[8,-1]]),track('little-head',[[0,0],[1.9,-4],[4.6,-4],[6.7,0],[8,0]])],[{id:'head-angle',defaultDrawingId:'front',drawings:[{id:'front',svgIds:['head-front']},{id:'front-blink',svgIds:['head-front-blink']},{id:'turn',svgIds:['head-turn']},{id:'turn-blink',svgIds:['head-turn-blink']}]}],[{setId:'head-angle',keys:headKeys}]);
family.slots=[{id:'plane-grip',boneId:'hand',x:18,y:-8,rotation:0}];
const fw=core.world(family), hw=core.point(fw.hand,{x:0,y:0});
family.motion={controllers:[{id:'hand-target',name:'Paper plane hand',space:'rig',x:hw.x,y:hw.y,keys:{x:[{time:0,value:hw.x,ease:{name:'inOut'}},{time:.65,value:hw.x-5,ease:{name:'inOut'}},{time:2.1,value:hw.x+16,ease:{name:'inOut'}},{time:4.5,value:hw.x+16,ease:{name:'inOut'}},{time:6.4,value:hw.x,ease:{name:'inOut'}},{time:8,value:hw.x,ease:{name:'inOut'}}],y:[{time:0,value:hw.y,ease:{name:'inOut'}},{time:.65,value:hw.y+9,ease:{name:'inOut'}},{time:2.1,value:hw.y-45,ease:{name:'inOut'}},{time:4.5,value:hw.y-45,ease:{name:'inOut'}},{time:6.4,value:hw.y,ease:{name:'inOut'}},{time:8,value:hw.y,ease:{name:'inOut'}}]}}],constraints:[{id:'plane-arm',name:'Keep hand on its target',type:'ik',rootId:'upper-arm',midId:'forearm',tipId:'hand',targetId:'hand-target',bend:-1,weight:1}]};
const plane=rig('Detailed — folded paper airplane',[['plane',path('M-64 -21L72 -12L-19 18L-28 3Z',P.paper)+path('M-64 -21L-9 -3L72 -12L-28 3L-19 18L-13 0Z','#dbc89c')+path('M-9 -3L-19 18L-13 0','none','#bea571',1)]],[bone('root',null,0,0)]);
// Plane artwork is authored at a centred local origin rather than stage coordinates.
plane.canvas={width:180,height:80};plane.svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80">'+g('plane',`<g transform="translate(90 40)">${path('M-64 -21L72 -12L-19 18L-28 3Z',P.paper)+path('M-64 -21L-9 -3L72 -12L-28 3L-19 18L-13 0Z','#dbc89c')}</g>` )+'</svg>';
const birdArt=path('M-38 8Q-21 2 -12 -7Q-24 -20 -20 -43Q-4 -33 5 -13Q12 -23 24 -22Q30 -22 34 -17L48 -15L34 -11Q28 4 12 10L-5 13L-29 29L-23 13Z',P.ink)+path('M-6 -4Q5 -8 15 -2L22 7Q10 15 -4 9Z',P.cream)+path('M7 -4L21 -1L16 8L3 7Z',P.coral)+circle(28,-17,2,P.paper);
const bird=rig('Detailed — outside swallow',[['bird',`<g transform="translate(70 60)">${birdArt}</g>`]],[bone('root',null,0,0)]);bird.canvas={width:140,height:120};bird.svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 120">'+g('bird',`<g transform="translate(70 60)">${birdArt}</g>` )+'</svg>';
const birdClip={...clip('outside-bird','Swallow outside the window',bird),x:650,y:160,scale:.62,stageMask:{regions:[[{x:707,y:53},{x:949,y:53},{x:949,y:282},{x:707,y:282}],[{x:962,y:53},{x:1213,y:53},{x:1213,y:282},{x:962,y:282}]]},motion:{blocks:[{id:'window-pass',name:'Outside flight',type:'path',start:0,duration:8,points:[{x:-160,y:25},{x:650,y:-20}],orient:false}]} };
const familyDoc=doc('Detailed — A glider for the garden',[clip('family','Family — body, arm, hands and head drawings',family),{...clip('paper-plane','Paper airplane — held at the grip socket',plane),x:0,y:0,motion:{constraints:[{id:'hand-grip',name:'Held by the child',type:'attach',targetClipId:'family',slotId:'plane-grip',offset:{x:0,y:0,rotation:-6},followRotation:true}]}},birdClip],{version:1,actors:[{clipId:'family',action:'articulated',requiredParts:['body','upper-arm','forearm','hand','head']},{clipId:'paper-plane',action:'rigid'}],travels:[{clipId:'outside-bird',restFacing:'right',mode:'forward',space:'exterior'}]});
save('detailed-family.mci.json',family);save('detailed-family.animatron.json',familyDoc);save('detailed-family.artwork.svg',family.svg);save('paper-plane.mci.json',plane);save('outside-bird.mci.json',bird);

// Original: a developed graphic room, simple expressive faces, deliberate quiet.
const B={navy:'#243b4b',cream:'#f5e9cb',skin:'#eed3a3',blue:'#7daeb6',gold:'#e4b44d',red:'#c96b4d',light:'#ffefb9'};
const bedroom=path('M0 0H1280V720H0Z',B.cream)+path('M0 526H1280V720H0Z','#c5b99c')+
 path('M786 62L1169 46V390L786 406Z',B.navy)+path('M803 79L1152 64V373L803 388Z','#648e9d')+
 path('M961 71L971 70V382L961 383ZM794 232L1160 218V230L794 245Z',B.cream)+
 path('M1111 98Q1058 139 1111 181Q1065 188 1051 148Q1038 113 1072 95Q1095 84 1111 98Z',B.light)+
 path('M839 124L843 135L855 137L844 141L840 153L837 141L826 138L837 135ZM1003 291L1006 300L1015 303L1006 306L1003 317L1000 306L990 303L1000 299ZM1093 325L1096 333L1104 336L1095 339L1092 347L1089 339L1081 336L1089 333Z',B.light)+
 path('M770 43L810 52L785 422L746 425ZM1156 38L1199 27L1237 412L1196 418Z',B.blue)+
 path('M94 85L359 87L354 254L91 252Z',B.navy)+path('M108 101H343V237H108Z',B.gold)+
 path('M141 192Q171 150 195 180L220 146L281 209H141Z',B.cream)+circle(291,135,17,B.red)+
 path('M63 301H331V315H63Z',B.navy)+path('M80 263H105V300H80ZM119 244H145V300H119Z',B.red)+path('M155 255H177V300H155Z',B.gold)+path('M191 267L214 259L228 299H201Z',B.blue)+
 path('M87 524L99 364L138 357L155 530Z',B.navy)+path('M77 365L147 355L174 414L60 425Z',B.red)+path('M77 365L147 355L136 375L73 385Z',B.gold)+
 path('M122 534Q143 500 154 464Q156 445 165 450Q180 466 164 493Q199 468 210 478Q213 492 177 518L204 524L195 564L137 565Z',B.blue)+
 path('M61 565L297 557L290 591L64 601Z',B.navy)+path('M81 599L104 598L97 681H77ZM260 591L280 589L292 668H271Z',B.navy)+
 path('M283 661Q647 593 1093 654L1121 689Q668 722 263 696Z',B.blue)+
 path('M342 342Q352 322 376 328L945 347Q979 350 982 382L970 586L335 573Z',B.navy)+
 path('M365 347Q376 339 394 344L923 361Q945 362 944 385L935 505L356 492Z',B.gold)+
 path('M363 411L946 430L939 513L354 494Z',B.cream)+
 path('M327 576L348 576L340 666H316ZM956 587L977 588L990 669H966Z',B.navy);
const childBody=path('M447 390Q470 378 495 393L535 444L523 504L429 501L416 456Z',B.red)+
 path('M446 396L463 408L485 395','none',B.cream,3)+
 path('M425 432Q408 445 402 465L449 480L457 467L427 457L443 442Z',B.skin)+
 path('M502 431L526 444Q545 464 564 486L592 495L588 507Q557 505 546 493L513 464L492 449Z',B.skin)+
 path('M442 464Q459 461 469 470L475 481Q473 487 467 485L458 476L461 490Q455 494 452 485L448 481L439 480Z',B.skin)+
 path('M436 488L511 493L543 544L517 556L480 528L449 546L423 530Z',B.red);
function childHead(blink=false){return path('M447 367L447 395Q464 412 482 393L480 365Z',B.skin)+
 path('M421 327Q420 297 451 286Q484 278 503 306L505 337Q502 365 478 378Q452 385 432 363L428 347Q414 347 413 335Q413 326 421 327Z',B.skin)+
 path('M421 333Q411 314 422 297L431 289L437 276L450 284L462 270L474 283L489 278L498 292Q516 307 506 327L493 313L490 300L478 312L464 302L449 315L437 309L430 336Z',B.navy)+
 (blink?path('M440 338Q447 345 454 338M477 335Q483 341 490 333','none',B.navy,2.7):ellipse(447,337,3.5,6,B.navy)+ellipse(484,333,3.5,6,B.navy))+
 path('M464 339L478 345L463 351Z',B.red)+path('M449 358Q467 371 485 354','none',B.navy,2.7);}
const bread=path('M613 470Q592 454 604 438Q610 426 624 428Q644 413 665 427Q681 420 689 437Q697 452 680 466L681 523L615 523Z','#c58a4a')+
 path('M621 471Q605 455 615 444Q622 435 632 439Q644 428 657 439Q674 430 680 445Q686 454 671 468L672 514L623 514Z',B.light)+
 ellipse(636,475,3,4,B.navy)+ellipse(658,475,3,4,B.navy)+path('M641 487Q647 492 653 486','none',B.navy,2)+
 path('M618 495L599 504L604 513L622 506ZM674 496L690 502L685 512L673 507Z','#c58a4a');
const bear=path('M734 452Q713 437 722 423Q735 410 748 426Q770 416 789 430Q804 414 815 428Q825 443 807 454Q822 483 806 504L815 524L792 531L772 517L749 533L727 526L735 507Q717 487 734 452Z',B.blue)+
 ellipse(768,474,23,19,B.cream)+ellipse(749,457,3,4,B.navy)+ellipse(788,459,3,4,B.navy)+path('M761 470L776 470L769 480Z',B.navy)+path('M769 480V486M769 486L760 490M769 486L777 490','none',B.navy,2);
const rabbit=path('M874 444Q849 395 862 381Q874 375 882 407L891 435Q900 388 912 392Q926 395 907 446Q928 456 925 478Q938 498 924 519L931 533L906 538L895 523L878 537L857 531L864 515Q848 493 856 473Q855 454 874 444Z',B.gold)+
 path('M865 393L881 438M910 405L899 439','none',B.red,4)+ellipse(875,466,2.8,4,B.navy)+ellipse(904,467,2.8,4,B.navy)+path('M885 476L895 476L890 482Z',B.red)+path('M889 482Q885 490 879 487M890 482Q896 491 901 487','none',B.navy,1.8);
const duvet=path('M355 504Q496 485 597 516Q748 541 937 503L973 578Q800 639 649 607Q513 576 335 599Z',B.blue)+
 path('M353 520Q491 501 591 532Q736 557 947 521L956 541Q744 576 587 550Q467 523 347 542Z',B.cream)+
 path('M344 563Q468 545 588 574Q738 601 964 557L970 576Q775 623 640 600Q467 568 338 587Z',B.gold)+
 path('M1038 463L1043 574L1169 576L1167 466Z',B.navy)+path('M1031 451L1176 451V472L1031 474Z',B.red)+
 path('M1061 483H1149V525H1061Z',B.cream)+circle(1104,504,4,B.navy)+path('M1048 576V639H1068V577ZM1141 576V639H1162V576Z',B.navy);
const lamp=path('M1101 446V383','none',B.navy,7)+ellipse(1101,447,27,7,B.navy)+path('M1073 330L1127 330L1148 387Q1104 399 1053 387Z',B.gold)+path('M1053 387Q1102 399 1148 387Q1113 380 1053 387Z',B.light);
const bedBones=[bone('root',null,0,0),bone('child-body','root',469,484),bone('child-head','child-body',-4,-146),bone('bread','root',649,479),bone('bear','root',769,474),bone('rabbit','root',890,477),bone('lamp','root',1101,385)];
const bed=rig('Original — Breadtime stories',[['room',bedroom],['child-body-art',childBody,'child-body'],['child-open',childHead(false),'child-head'],['child-blink',childHead(true),'child-head'],['bread-plush',bread,'bread'],['bear-plush',bear,'bear'],['rabbit-plush',rabbit,'rabbit'],['duvet',duvet],['bedside-lamp',lamp,'lamp']],bedBones,[track('child-body',[[0,0,0,0],[2.4,0,0,-1.5],[4.7,0,0,0],[8,0,0,0]]),track('child-head',[[0,-2],[1.8,1],[4.2,1],[6.2,-2],[8,-2]]),track('bread',[[0,-3],[1.8,2],[3.5,2],[5.8,-3],[8,-3]]),track('lamp',[[0,0],[2.4,1.2],[4.2,1.2],[6.4,0],[8,0]])],[{id:'bedtime-eyes',defaultDrawingId:'open',drawings:[{id:'open',svgIds:['child-open']},{id:'blink',svgIds:['child-blink']}]}],[{setId:'bedtime-eyes',keys:[[0,'open'],[1.4,'blink'],[1.54,'open'],[4.9,'blink'],[5.04,'open'],[8,'open']].map(([time,drawingId])=>({time,drawingId}))}]);
const bedDoc=doc('Original — Breadtime stories',[clip('bedtime','Child, bread plush and a quiet room',bed)],{version:1,actors:[{clipId:'bedtime',action:'articulated',requiredParts:['child-body','child-head','bread','lamp']}],travels:[]});
save('original-bedtime.mci.json',bed);save('original-bedtime.animatron.json',bedDoc);save('original-bedtime.artwork.svg',bed.svg);

// Standalone illustration masters show only the default registered head drawing.
function still(r){let s=r.svg;for(const set of r.drawingSets??[])for(const d of set.drawings)if(d.id!==set.defaultDrawingId)for(const id of d.svgIds)s=s.replace(`<g id="${id}">`,`<g id="${id}" opacity="0">`);return s;}
save('detailed-family.key-pose.svg',still(family).replace('</svg>',`<g transform="translate(${core.point(fw.hand,{x:18,y:-8}).x} ${core.point(fw.hand,{x:18,y:-8}).y}) rotate(-6)">${path('M-64 -21L72 -12L-19 18L-28 3Z',P.paper)+path('M-64 -21L-9 -3L72 -12L-28 3L-19 18L-13 0Z','#dbc89c')}</g></svg>`));
save('original-bedtime.key-pose.svg',still(bed));
console.log('Built two complete editable vector scenes, their rigs, registered drawings and motion programs.');

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {fireEvent,render,screen} from "@testing-library/react";
import {welcomePreset} from "../presets";
import {SceneReviewFields} from "./SceneReviewFields";
test("humans declare acting intent and see missing controls without implying visual approval",()=>{
 const doc=welcomePreset();doc.scenePlan={version:1,actors:[{clipId:doc.clips[0].id,action:"articulated",requiredParts:["torso","head","hand"]}],travels:[]};
 const onChange=vi.fn();const view=render(<SceneReviewFields doc={doc} onChange={onChange}/>);
 fireEvent.click(screen.getByRole("button",{name:"Check motion structure"}));
 expect(screen.getByRole("status")).toHaveTextContent("Motion structure needs work");
 view.rerender(<SceneReviewFields doc={{...doc,name:"Changed"}} onChange={onChange}/>);
 expect(screen.getByRole("status")).toHaveTextContent("Run the checks again");
});

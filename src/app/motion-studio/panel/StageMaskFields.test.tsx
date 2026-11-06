// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StageMaskFields } from "./StageMaskFields";
import { makeText } from "../presets";

test("human enables a stage region and edits polygon coordinates without markup",()=>{
 const clip=makeText({id:"bird",text:"Bird"});
 const onChange=vi.fn();
 const props={clip,stage:{width:200,height:100},onChange};
 const view=render(<StageMaskFields {...props} />);
 fireEvent.click(screen.getByRole("button",{name:"Stage visibility regions"}));
 fireEvent.click(screen.getByRole("checkbox",{name:"Clip to stage regions"}));
 const masked=onChange.mock.calls[0][0];
 expect(masked.stageMask.regions[0]).toEqual([{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:0,y:100}]);
 view.rerender(<StageMaskFields {...props} clip={masked} />);
 fireEvent.click(screen.getByRole("button",{name:"Region 1 points"}));
 fireEvent.change(screen.getByRole("spinbutton",{name:"Region 1 point 1 X in px"}),{target:{value:"20"}});
 const edited=onChange.mock.calls.at(-1)![0];
 expect(edited.stageMask.regions[0][0].x).toBe(20);
 expect(masked.stageMask.regions[0][0].x).toBe(0);
 fireEvent.click(screen.getByRole("button",{name:"Add a stage region"}));
 expect(onChange.mock.calls.at(-1)![0].stageMask.regions).toHaveLength(2);
});

# Scene motion structure correction

## Confirmed production failures

The 14-key family example proved sparse interpolation, not natural character acting. It must not be cited as proof of a coherent animated cast. Its room plate includes mother, boy and the girl’s torso; only the forearm/hand/plane carrier and replacement heads are independent. The right-facing bird was authored moving left. As the last painted clip without an aperture mask it sat above the flattened room. Technical import, fewer keys and successful MP4 export missed all three errors.

## Implementation checklist

- [x] Add bounded stage-space aperture masks in the existing renderer; all viewers/exporters share the behavior. No raw SVG or CSS payload. Invalid input fails closed. Mask-bearing compositions explicitly opt into document3, so earlier applications reject rather than ignore the mask. Document2 defaults and Rig1/2/3 remain supported.
- [x] Persist production intent separately from visual approval: still/rigid/articulated action, action-specific independent parts, travel facing/intention, interior/exterior space. Expose checks and intent editing to the human.
- [x] Use the application evaluator for a bounded direction preflight. Skip invisible loop resets, include inherited/bone transforms, require an actual mask for exterior travel. Reject unsupported character actions before writing Composer output; never silently reduce acting to a sliding carrier.
- [x] Prove the existing mistakes fail; forward masked travel passes; the requested natural-acting family still fails until artwork is rebuilt. Preserve that unmet requirement explicitly.
- [x] Test mask pixels through the actual export path, save/reopen, invalid imports, stage-vs-parent transforms, direction/visibility and unchanged legacy files. Review visual frames separately.
- [x] Update private plugin source/packages and instructions, commit/push and update the review PR. No main application merge/deployment.

## Production architecture

1. **Action intent before parts.** Define who reacts, gaze/contact targets, anticipation, main action and settling. Articulated intent declares independent torso, shoulder/upper arm, forearm/hand and head/hair controls as needed for that action. This is an action-specific inventory, not a universal skeleton template.
2. **Artwork readiness before motion.** Draw or supervise separate parts and concealed paint. Bound each needed control to real artwork. Multiple bone names on the same flat plate do not establish editability. If required parts are absent, rebuild the art or explicitly narrow the action; never report the narrowed result as the requested acting.
3. **Scene space before paths.** Declare interior/exterior, inspect the aperture/foreground silhouette, and author masks/paint order. A clip called “outside” has no spatial effect. Parent attachments solve transforms; masks solve visibility. Neither alone establishes correct foreground anatomy or contact.
4. **Coordinated sparse motion.** Choose keys for intention and reaction, not identical sine-wave drift on every part. Use independent timing/curves, shared carriers for rigid contacts, and registered drawing changes for perspective. A flying subject needs authored facing and direction; flapping needs actual wing artwork/control.
5. **Two reviews.** Structural preflight checks declared controls, facing and portal presence; actual-frame review checks silhouette, anatomy, occlusion, spacing, seams, contacts and acting. Passing either review is not user approval.

## Deliberate limits

A hand-authored aperture is not automatic image separation or a complete depth graph. The corrected family/bird file is a scoped spatial diagnostic: the family remains a limited rigid gesture and the bird retains one wing pose. The example uses separate inspected window regions so its mullion remains in front; it is deliberately a scoped sky aperture, not a complete room segmentation. A second plan requests real articulated family acting and intentionally fails on missing controls. Preparing that artwork is required before claiming a natural character result. No mesh deformation, automatic constraints, hidden-paint reconstruction or native AE export is implied.

## Evidence

Actual source audit reproduced wrong direction, absent portal and missing articulation. Single-clip developer exports also retain stage masks through StageCanvas. A pixel comparison confirms the actual window mullion is unchanged as the bird crosses behind it. New source tests cover these failures plus corrected scoped motion, empty/malformed intent, strict document3 masks/imports/storage/sharing and human edits. New mask/review modules exceeded80% statements/branches and had100% line/function coverage in the focused run. Actual Chrome mask pixels and the document3 editor journey passed; the natural-acting family requirement remains deliberately rejected. Review/push/package evidence is recorded at delivery.

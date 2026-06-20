// Framer Motion's feature bundle, isolated so MotionProvider can import it
// dynamically AFTER hydration (see motion-provider.tsx). domMax is the superset
// covering layout animations + gestures, matching the previous static
// `features={domMax}` exactly — only the load timing changes.
import { domMax } from "motion/react";

export default domMax;

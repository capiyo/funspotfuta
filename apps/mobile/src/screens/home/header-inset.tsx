// screens/home/header-inset.ts
//
// Height of the overlay header on the home screen. Arena / Feed / Logs use it as
// top padding for their scrollable content, so content starts below the header
// at scroll position 0 and scrolls up underneath it once the header fades.
import { createContext, useContext } from 'react';

export const HeaderInsetContext = createContext(0);

/** Returns the header height in px (0 outside the home screen). */
export function useHeaderInset(): number {
    return useContext(HeaderInsetContext);
}
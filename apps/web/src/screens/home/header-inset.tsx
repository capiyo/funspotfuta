// screens/home/header-inset.ts
//
// Height of the overlay header on the home screen. Lists use it as top
// padding so content starts below the header and scrolls underneath it.
import { createContext, useContext } from 'react';

export const HeaderInsetContext = createContext(0);

/** Returns the header height in px (0 outside the home screen). */
export function useHeaderInset(): number {
  return useContext(HeaderInsetContext);
}

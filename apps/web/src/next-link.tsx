import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';

type Props = PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }>;

export default function Link({ href, children, prefetch: _prefetch, ...props }: Props) {
  return <RouterLink to={href} {...props}>{children}</RouterLink>;
}

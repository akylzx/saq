import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "solid" | "ghost";

interface CommonProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

type AnchorProps = CommonProps & { href: string };
type NativeButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

/** Pill button. Renders an <a> when given href, otherwise a <button>. */
export function Button(props: AnchorProps | NativeButtonProps) {
  const { variant = "solid", children, className } = props;
  const cls = `${styles.btn} ${styles[variant]} ${className ?? ""}`;

  if ("href" in props && props.href !== undefined) {
    return (
      <a className={cls} href={props.href}>
        {children}
      </a>
    );
  }

  const { variant: _v, children: _c, className: _cn, ...rest } = props;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

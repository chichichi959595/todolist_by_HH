// WunderUI Free (MIT) — https://wunderui.com
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// 結構、尺寸、按壓縮放照 WunderUI；顏色不用它的靛藍品牌色，
// 全部對到本專案原本的 shadcn 中性色 token（primary 是墨色）。
// WunderUI 的實心按鈕 hover 用 brightness-95 是因為靛藍底配白字，
// 半透明會變淡、對比掉到 AA 以下；這裡的 primary 是近黑色，
// 變淡反而看得出來而且對比仍遠高於 4.5:1，所以維持原本的 /85。
//
// 原本 shadcn 的 asChild 換成 Base UI 的 render：
// <Button nativeButton={false} render={<a href="…" />}>…</Button>
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition duration-(--duration-fast) ease-entrance outline-none select-none shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)] active:not-aria-[haspopup]:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:border-ring focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        plain: "bg-card border-border-control text-foreground hover:bg-muted/50",
        primary: "border-primary bg-primary text-primary-foreground hover:bg-primary/85",
        brand: "border-primary bg-primary text-primary-foreground hover:bg-primary/85",
        gradient:
          "border-primary bg-gradient-to-b from-primary/80 to-primary text-primary-foreground shadow-[inset_0px_1px_2px_0px_rgba(255,255,255,0.25)] hover:brightness-110",
        dark: "bg-foreground text-background hover:bg-foreground/85",
        light: "border-border bg-background text-foreground hover:bg-muted",
        outline:
          "border-border bg-background text-foreground hover:bg-muted aria-expanded:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        // 選到的樣子：淡灰底
        tint: "bg-muted text-foreground hover:bg-muted/70",
        ghost:
          "bg-transparent text-foreground shadow-none hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive shadow-none hover:bg-destructive/20 focus-visible:border-destructive/40 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "bg-transparent px-0! text-primary shadow-none underline-offset-4 hover:underline",
      },
      shape: {
        rounded: "rounded-md",
        pill: "rounded-full",
      },
      size: {
        // 高度和左右內距是 index.css 裡的密度 token：32/36/40/44/48。
        // 有圖示的那一側內縮 2px（2xl 4px）。
        sm: "h-(--control-sm) px-(--control-px-sm) text-sm has-data-[icon=inline-end]:pr-[calc(var(--control-px-sm)-0.125rem)] has-data-[icon=inline-start]:pl-[calc(var(--control-px-sm)-0.125rem)]",
        md: "h-(--control-md) px-(--control-px-md) text-sm has-data-[icon=inline-end]:pr-[calc(var(--control-px-md)-0.125rem)] has-data-[icon=inline-start]:pl-[calc(var(--control-px-md)-0.125rem)]",
        lg: "h-(--control-lg) px-(--control-px-lg) text-sm has-data-[icon=inline-end]:pr-[calc(var(--control-px-lg)-0.125rem)] has-data-[icon=inline-start]:pl-[calc(var(--control-px-lg)-0.125rem)]",
        xl: "h-(--control-xl) px-(--control-px-xl) text-base has-data-[icon=inline-end]:pr-[calc(var(--control-px-xl)-0.125rem)] has-data-[icon=inline-start]:pl-[calc(var(--control-px-xl)-0.125rem)]",
        "2xl": "h-(--control-2xl) px-(--control-px-2xl) text-lg has-data-[icon=inline-end]:pr-[calc(var(--control-px-2xl)-0.25rem)] has-data-[icon=inline-start]:pl-[calc(var(--control-px-2xl)-0.25rem)]",
        // WunderUI 沒有的：只放圖示的正方形按鈕
        "icon-sm": "size-(--control-sm)",
        icon: "size-(--control-md)",
      },
    },
    defaultVariants: {
      variant: "primary",
      shape: "rounded",
      size: "md",
    },
  }
)

function Button({
  className,
  variant,
  shape,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, shape, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

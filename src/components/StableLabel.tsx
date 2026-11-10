interface StableLabelProps {
  /** Every text the label can show, in any language */
  options: string[]
  selected: string
  /** Horizontal placement of the visible text inside the reserved box */
  align?: "center" | "end"
}

/** Stacks all options in one grid cell so the box is always as wide as the widest one */
export function StableLabel({ options, selected, align = "center" }: StableLabelProps) {
  return (
    <span
      className={`inline-grid ${align === "end" ? "justify-items-end" : "justify-items-center"}`}
    >
      {options.map((text) => (
        <span
          key={text}
          className={`col-start-1 row-start-1 ${text === selected ? "" : "invisible"}`}
        >
          {text}
        </span>
      ))}
    </span>
  )
}

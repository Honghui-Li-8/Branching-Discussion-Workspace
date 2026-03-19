export const IntroScreen = () => {
  return (
    <section className="flex h-auto min-h-[430px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#8fbad1] bg-[linear-gradient(180deg,#f5fcff_0%,#fffef9_100%)] px-6 py-8 text-center lg:h-[calc(100vh-40px)] lg:min-h-0">
      <p className="m-0 text-xs uppercase tracking-[0.14em] text-[#4b7f99]">
        Branching Decision Workspace
      </p>
      <h1 className="my-[14px] text-[clamp(28px,4vw,46px)] leading-[1.12] text-[#12384c]">
        Start by opening or creating a workspace
      </h1>
      <p className="m-0 max-w-[620px] text-[#3f6c81]">
        This area will switch to a brainstorm-style tree canvas once a workspace is
        selected.
      </p>
    </section>
  )
}

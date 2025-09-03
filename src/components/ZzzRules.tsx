export default function ZzzRules() {
  return (
    <div className="rules-card">
      <strong>Rules:</strong>
      <p>
        For ZZZ PvP you can fight in either of 2 modes, 2v2 or 3v3 in Deadly
        Assault boss stages where you compete for the highest total score.
      </p>
      <strong>Match Procedure:</strong>
      <ul>
        <li>
          2v2: Make teams, draft, then select 2 out of the 3 bosses your team
          will fight.
        </li>
        <li>3v3: Draft, then fight all 3 bosses.</li>
        <li>The bosses picked in 2v2 must be unique for a team.</li>
      </ul>
      <strong>Draft:</strong>
      <p>Three pick types: Bans, Ace(s), Normal Pick.</p>
      <p>
        During draft, select agents and wengines up to 6/9 cost for 2v2/3v3
        respectively. Over cost limit results in score penalty.
      </p>
      <p>Drafting phase will proceed as the number shown in the box.</p>
      <strong>Picks:</strong>
      <ul>
        <li>
          <strong>Normal pick (blank boxes):</strong> pick unpicked/unbanned
          agents.
        </li>
        <li>
          <strong>Ban (red boxes):</strong> elect an agent to ban (cannot ban
          first 4 picks).
        </li>
        <li>
          <strong>Ace pick (orange/yellow boxes):</strong> select any unbanned
          agent, including opponent's picks; only one copy per team allowed.
        </li>
      </ul>
      <strong>Cost:</strong>
      <ul>
        <li>
          Limited S Rank agent: starts at 1 cost, increases by 0.5 per unique
          mindscape (except M3 &amp; M5).
        </li>
        <li>Standard S Rank agent: starts at 1, 1.5 cost at M6.</li>
        <li>All A Rank agents: 0.5 cost all mindscapes.</li>
        <li>
          Limited S Rank wengines: 0.25 starting cost, 0.5 at W3+ refinements.
        </li>
        <li>
          Standard S Rank wengines: 0 starting cost, 0.25 at W3+ refinements.
        </li>
        <li>A &amp; B Rank wengines: 0 cost at all refinements.</li>
        <li>Bangboos do not cost points.</li>
      </ul>
      <strong>Penalty and Resets:</strong>
      <ul>
        <li>
          Every 0.25 points above limit (6 for 2v2, 9 for 3v3) reduces team
          score by 2500.
        </li>
        <li>Each team has 2 resets per match.</li>
        <li>Resets must be used before ending stream.</li>
        <li>
          Battle starts when boss appears; resets after consume one reset.
        </li>
        <li>Previous runs voided; only latest run counts.</li>
      </ul>
      <strong>Play:</strong>
      <p>
        After draft, players select bosses and test teams. Runs must be live
        streamed for fairness. If you are unable to stream the run, ask your
        opponents&apos; consent for screenshot submission.
      </p>
      <strong>Discord Server:</strong>{" "}
      <a
        href="https://discord.gg/MHzc5GRDQW"
        target="_blank"
        rel="noreferrer"
        className="rules-link"
      >
        Join Discord Server
      </a>
    </div>
  );
}

export default function CerydraRules() {
  return (
    <div className="rules-card">
      <strong>Rules:</strong>
      <p>
        Cerydra PvP is a competitive Honkai: Star Rail draft mode where players
        build teams, select eidolons and light cones, and compete using a
        point-based cost system. Matches use either the 2-ban or 3-ban draft
        format, and drafting proceeds according to the sequence displayed on the
        draft interface.
      </p>
      <strong>Match Procedure:</strong>
      <ul>
        <li>
          The side that winsside pick must lock their
          lightcones first.
        </li>
        <li>
          After locking, each team may perform one lightcone
          adjustment: add or remove one cone they drafted.
        </li>
        <li>
          Open roster is required. Updated rosters must be shown at least{" "}
          2 hours before the match.
        </li>
        <li>Test runs are allowed before the official attempt.</li>
        <li>
          After both sides lock their draft, the{" "}
          first run must begin within 10 minutes.
        </li>
        <li>
          If no one starts a run within 10 minutes, the order is forced:
          <br />
          <strong>Blue 1 → Red 1 → Blue 2 → Red 2.</strong>
        </li>
      </ul>
      <strong>Draft:</strong>
      <p>
        Two formats are supported: 2-ban and{" "}
        3-ban. Each format has its own ban/pick sequence,
        displayed directly on the drafting page. Slots marked as BAN may only be
        used to ban characters, and normal pick slots allow selecting any valid,
        unbanned character.
      </p>
      <strong>Picks:</strong>
      <ul>
        <li>
          <strong>Normal Pick:</strong> Select any unpicked, unbanned character.
        </li>
        <li>
          <strong>Ban Pick:</strong> Remove a character from being selected by
          either team.
        </li>
      </ul>
      <strong>Cost:</strong>
      <ul>
        <li>
          Every 4 points difference equals{" "}
          +1 cycle advantage for the leading team.
        </li>
        <li>
          <strong>Castorice proc:</strong> incurs a{" "}
          +1.5 cost penalty unless Castorice is drafted on your
          team.
        </li>
        <li>
          If your character dies without taking another action, being healed, or
          being shielded, then no Castorice penalty applies.
        </li>
        <li>
          If you do not own Castorice, then{" "}
          no death penalties apply at all.
        </li>
      </ul>
      <strong>Penalty and Resets:</strong>
      <ul>
        <li>
          Runs must be livestreamed.
        </li>
        <li>
          Cones and eidolons must be shown{" "}
          before and after each run before ending the
          screenshare.
        </li>
        <li>Only the latest streamed run is counted as the official result.</li>
      </ul>
      <strong>Play:</strong>
      <p>
        After drafting and lightcone locking, teams perform their runs according
        to the required order. If a player cannot stream, they must acquire
        their opponent’s consent for screenshot submission. Sportsmanship and
        transparency are expected from both teams.
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

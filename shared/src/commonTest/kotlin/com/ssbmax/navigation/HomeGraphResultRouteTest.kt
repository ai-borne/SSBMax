package com.ssbmax.navigation

import com.ssbmax.shared.domain.model.TestType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * KMP-convergence Phase 3a, row #1: PIQ/GTO_GD/GTO_LECTURETTE/GTO_GPE were
 * missing from `HomeGraph`'s onNavigateToResult switch even though all four
 * result destinations are already registered elsewhere (WrittenTestsGraph,
 * GTOGraph) -- their OLQ dashboard result tiles silently fell through to the
 * "not yet ported" placeholder. [homeResultRoute] is the extracted, pure
 * version of that switch.
 *
 * Phase 3d: [homeResultRoute] returns a real [SSBMaxDestinations] instance
 * now (data-class equality), not a route string.
 */
class HomeGraphResultRouteTest {

    @Test
    fun previouslyMissingTestTypes_nowResolveToTheirRegisteredResultRoute() {
        assertEquals(
            SSBMaxDestinations.PIQSubmissionResult("sub-1"),
            homeResultRoute(TestType.PIQ, "sub-1")
        )
        assertEquals(
            SSBMaxDestinations.GTOGDResult("sub-2"),
            homeResultRoute(TestType.GTO_GD, "sub-2")
        )
        assertEquals(
            SSBMaxDestinations.GTOLecturetteResult("sub-3"),
            homeResultRoute(TestType.GTO_LECTURETTE, "sub-3")
        )
        assertEquals(
            SSBMaxDestinations.GTOGPEResult("sub-4"),
            homeResultRoute(TestType.GTO_GPE, "sub-4")
        )
    }

    @Test
    fun previouslySupportedTestTypes_areUnaffected() {
        assertEquals(SSBMaxDestinations.OIRTestResult("s"), homeResultRoute(TestType.OIR, "s"))
        assertEquals(SSBMaxDestinations.PPDTSubmissionResult("s"), homeResultRoute(TestType.PPDT, "s"))
        assertEquals(SSBMaxDestinations.TATSubmissionResult("s"), homeResultRoute(TestType.TAT, "s"))
        assertEquals(SSBMaxDestinations.WATSubmissionResult("s"), homeResultRoute(TestType.WAT, "s"))
        assertEquals(SSBMaxDestinations.SRTSubmissionResult("s"), homeResultRoute(TestType.SRT, "s"))
        assertEquals(SSBMaxDestinations.SDSubmissionResult("s"), homeResultRoute(TestType.SD, "s"))
        assertEquals(SSBMaxDestinations.InterviewResult("s"), homeResultRoute(TestType.IO, "s"))
    }

    @Test
    fun stillUnportedTestTypes_returnNull() {
        assertNull(homeResultRoute(TestType.GTO_PGT, "s"))
        assertNull(homeResultRoute(TestType.GTO_GOR, "s"))
        assertNull(homeResultRoute(TestType.GTO_HGT, "s"))
        assertNull(homeResultRoute(TestType.GTO_IO, "s"))
        assertNull(homeResultRoute(TestType.GTO_CT, "s"))
        assertNull(homeResultRoute(TestType.GTO_FGT, "s"))
    }
}

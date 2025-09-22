const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// Reschedule booking controller
const rescheduleBooking = async (req, res) => {
  try {
    const { bookingId } = req.params
    const { startAt, endAt, seatNumbers } = req.body
    const userId = req.user?.id

    console.log('🔄 Starting reschedule process for booking:', bookingId)

    // Validate required fields
    if (!startAt || !endAt) {
      return res.status(400).json({
        success: false,
        error: 'Start time and end time are required'
      })
    }

    // Validate date format and future booking
    const newStartTime = new Date(startAt)
    const newEndTime = new Date(endAt)
    const now = new Date()

    if (newStartTime <= now) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reschedule to a past time'
      })
    }

    if (newEndTime <= newStartTime) {
      return res.status(400).json({
        success: false,
        error: 'End time must be after start time'
      })
    }

    // Fetch current booking
    console.log('📋 Fetching current booking data...')
    const { data: currentBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError || !currentBooking) {
      console.error('❌ Error fetching booking:', fetchError)
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      })
    }

    // Verify booking belongs to user (if userId provided)
    if (userId && currentBooking.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only reschedule your own bookings'
      })
    }

    // Check if booking can be rescheduled
    if (currentBooking.rescheduleCount >= 1) {
      return res.status(400).json({
        success: false,
        error: 'This booking has already been rescheduled once. No further reschedules allowed.'
      })
    }

    // Check if booking is upcoming (not past)
    const bookingStartTime = new Date(currentBooking.startAt)
    if (bookingStartTime <= now) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reschedule past bookings'
      })
    }

    // Check if booking is confirmed/paid
    if (!currentBooking.confirmedPayment) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reschedule unpaid bookings'
      })
    }

    // Check seat availability for new time
    console.log('🪑 Checking seat availability for new time...')
    const { data: conflictingBookings, error: conflictError } = await supabase
      .from('Booking')
      .select('id, seatNumbers, startAt, endAt')
      .eq('location', currentBooking.location)
      .eq('confirmedPayment', true)
      .neq('id', bookingId) // Exclude current booking
      .or(`and(startAt.lt.${endAt},endAt.gt.${startAt})`)

    if (conflictError) {
      console.error('❌ Error checking seat conflicts:', conflictError)
      return res.status(500).json({
        success: false,
        error: 'Failed to check seat availability'
      })
    }

    // If seatNumbers provided, check if they're available
    if (seatNumbers && seatNumbers.length > 0) {
      const requestedSeats = seatNumbers
      const conflictingSeats = []

      conflictingBookings.forEach(conflict => {
        if (conflict.seatNumbers) {
          conflict.seatNumbers.forEach(seat => {
            if (requestedSeats.includes(seat)) {
              conflictingSeats.push(seat)
            }
          })
        }
      })

      if (conflictingSeats.length > 0) {
        return res.status(400).json({
          success: false,
          error: `The following seats are not available: ${conflictingSeats.join(', ')}`,
          conflictingSeats
        })
      }
    } else {
      // If no seats specified, use original seats and check availability
      if (currentBooking.seatNumbers && currentBooking.seatNumbers.length > 0) {
        const originalSeats = currentBooking.seatNumbers
        const conflictingSeats = []

        conflictingBookings.forEach(conflict => {
          if (conflict.seatNumbers) {
            conflict.seatNumbers.forEach(seat => {
              if (originalSeats.includes(seat)) {
                conflictingSeats.push(seat)
              }
            })
          }
        })

        if (conflictingSeats.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Original seats ${conflictingSeats.join(', ')} are not available at the new time. Please select different seats.`,
            conflictingSeats,
            requiresSeatSelection: true
          })
        }
      }
    }

    // Update booking with new time and seats
    console.log('✅ Updating booking with new schedule...')
    const updateData = {
      startAt: newStartTime.toISOString(),
      endAt: newEndTime.toISOString(),
      rescheduleCount: 1,
      rescheduledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Only update seatNumbers if provided
    if (seatNumbers) {
      updateData.seatNumbers = seatNumbers
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('Booking')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating booking:', updateError)
      return res.status(500).json({
        success: false,
        error: 'Failed to reschedule booking'
      })
    }

    console.log('🎉 Booking rescheduled successfully:', updatedBooking.id)

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      booking: updatedBooking
    })

  } catch (error) {
    console.error('❌ Error in rescheduleBooking:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

// Get available seats for reschedule
const getAvailableSeatsForReschedule = async (req, res) => {
  try {
    const { bookingId } = req.params
    const { startAt, endAt } = req.query

    if (!startAt || !endAt) {
      return res.status(400).json({
        success: false,
        error: 'Start time and end time are required'
      })
    }

    // Get current booking to get location
    const { data: currentBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('location')
      .eq('id', bookingId)
      .single()

    if (fetchError || !currentBooking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      })
    }

    // Get conflicting bookings for the new time
    const { data: conflictingBookings, error: conflictError } = await supabase
      .from('Booking')
      .select('seatNumbers')
      .eq('location', currentBooking.location)
      .eq('confirmedPayment', true)
      .neq('id', bookingId) // Exclude current booking
      .or(`and(startAt.lt.${endAt},endAt.gt.${startAt})`)

    if (conflictError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to check seat availability'
      })
    }

    // Get all occupied seats
    const occupiedSeats = new Set()
    conflictingBookings.forEach(booking => {
      if (booking.seatNumbers) {
        booking.seatNumbers.forEach(seat => occupiedSeats.add(seat))
      }
    })

    // Define all available seats (you may want to make this dynamic)
    const allSeats = [
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10',
      'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20'
    ]

    const availableSeats = allSeats.filter(seat => !occupiedSeats.has(seat))

    res.json({
      success: true,
      availableSeats,
      occupiedSeats: Array.from(occupiedSeats)
    })

  } catch (error) {
    console.error('❌ Error in getAvailableSeatsForReschedule:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

module.exports = {
  rescheduleBooking,
  getAvailableSeatsForReschedule
}

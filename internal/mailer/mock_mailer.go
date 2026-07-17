package mailer

import "github.com/stretchr/testify/mock"

type MockClient struct {
	mock.Mock
}

func (m *MockClient) SendQREmail(toEmail, toName, userID string) error {
	args := m.Called(toEmail, toName, userID)
	return args.Error(0)
}

func (m *MockClient) SendWalkInQueuedEmail(toEmail string, position int) error {
	args := m.Called(toEmail, position)
	return args.Error(0)
}

func (m *MockClient) SendWalkInAcceptedEmail(toEmail, userID string) error {
	args := m.Called(toEmail, userID)
	return args.Error(0)
}

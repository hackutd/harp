package mailer

import (
	"time"

	"github.com/stretchr/testify/mock"
)

type MockClient struct {
	mock.Mock
}

func (m *MockClient) SendMagicLinkEmail(toEmail, magicLink string, codeLifetime time.Duration) error {
	args := m.Called(toEmail, magicLink, codeLifetime)
	return args.Error(0)
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

func (m *MockClient) SetIdentityResolver(fn IdentityFunc) {}

func (m *MockClient) SendDecisionEmail(toEmail, toName string, decision Decision) error {
	args := m.Called(toEmail, toName, decision)
	return args.Error(0)
}

func (m *MockClient) SendDecisionsReleasedEmail(toEmail, toName string) error {
	args := m.Called(toEmail, toName)
	return args.Error(0)
}
